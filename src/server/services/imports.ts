import fs from "node:fs/promises";
import path from "node:path";
import { JobType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { extractReceiptFromImageOrPdf, extractReceiptFromText, extractStatementFromText } from "@/server/ai/extraction";
import { applyCategoryRules } from "@/server/services/categorization";
import { buildDedupeHash } from "@/server/services/dedupe";
import { convertAmount } from "@/server/services/fx";
import { parseCsv, parsePdfText, parseRawText, parseXlsx, type ParsedRow } from "@/server/services/file-parse";
import { logAIAudit } from "@/server/services/ai-audit";

export type CandidateTransaction = {
  date: string;
  description: string;
  merchantName?: string | null;
  amount: number;
  currency: string;
  direction: "INCOME" | "EXPENSE";
  categoryHint?: string | null;
};

type ReceiptResult = {
  merchantName: string | null;
  date: string;
  currency: string;
  total: number;
};

function normalizeRowToCandidate(row: ParsedRow): CandidateTransaction | null {
  const description = row.description || row.narration || row.details || row.memo;
  const date = row.date || row.transaction_date || row.posted_at;
  const amountRaw = row.amount || row.debit || row.credit;
  const currency = row.currency || "NGN";

  if (!description || !date || !amountRaw) return null;

  const amount = Number(String(amountRaw).replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;

  const debit = row.debit ? Number(String(row.debit).replace(/,/g, "")) : null;
  const direction = debit && debit > 0 ? "EXPENSE" : amount < 0 ? "EXPENSE" : "INCOME";

  return {
    date,
    description,
    merchantName: row.merchant || null,
    amount: Math.abs(amount),
    currency,
    direction
  };
}

async function parseStatementFile(
  userId: string,
  importJobId: string,
  uploadedFileId: string,
  filePath: string,
  mimeType: string
): Promise<CandidateTransaction[]> {
  const buffer = await fs.readFile(filePath);

  if (mimeType.includes("csv") || filePath.endsWith(".csv")) {
    return parseCsv(buffer).map(normalizeRowToCandidate).filter(Boolean) as CandidateTransaction[];
  }

  if (mimeType.includes("sheet") || filePath.endsWith(".xlsx")) {
    return parseXlsx(buffer).map(normalizeRowToCandidate).filter(Boolean) as CandidateTransaction[];
  }

  if (mimeType.includes("text") || filePath.endsWith(".txt")) {
    const rawText = parseRawText(buffer);
    await prisma.uploadedFile.update({ where: { id: uploadedFileId }, data: { rawText: rawText.slice(0, 120000) } });
    const extracted = await extractStatementFromText(rawText);
    await logAIAudit({
      userId,
      importJobId,
      model: extracted.model,
      purpose: "statement_extraction",
      prompt: extracted.prompt,
      responseJson: extracted.parsed
    });
    return extracted.parsed.transactions;
  }

  if (mimeType.includes("pdf") || filePath.endsWith(".pdf")) {
    const rawText = await parsePdfText(buffer);
    if (!rawText.trim()) {
      throw new Error("Could not extract text from PDF. Try CSV/XLSX, or paste text into TXT format.");
    }
    await prisma.uploadedFile.update({ where: { id: uploadedFileId }, data: { rawText: rawText.slice(0, 120000) } });
    const extracted = await extractStatementFromText(rawText);
    await logAIAudit({
      userId,
      importJobId,
      model: extracted.model,
      purpose: "statement_extraction",
      prompt: extracted.prompt,
      responseJson: extracted.parsed
    });
    return extracted.parsed.transactions;
  }

  throw new Error("Unsupported statement format");
}

async function parseReceiptFile(
  userId: string,
  importJobId: string,
  uploadedFileId: string,
  filePath: string,
  mimeType: string
): Promise<ReceiptResult> {
  const buffer = await fs.readFile(filePath);

  if (mimeType.includes("pdf") || filePath.endsWith(".pdf")) {
    const rawText = await parsePdfText(buffer);
    await prisma.uploadedFile.update({ where: { id: uploadedFileId }, data: { rawText: rawText.slice(0, 120000) } });
    const extracted = await extractReceiptFromText(rawText);
    await logAIAudit({
      userId,
      importJobId,
      model: extracted.model,
      purpose: "receipt_extraction",
      prompt: extracted.prompt,
      responseJson: extracted.parsed
    });
    return extracted.parsed;
  }

  if (mimeType.startsWith("image/")) {
    const base64 = buffer.toString("base64");
    const extracted = await extractReceiptFromImageOrPdf(base64, mimeType, path.basename(filePath));
    await logAIAudit({
      userId,
      importJobId,
      model: extracted.model,
      purpose: "receipt_extraction",
      prompt: extracted.prompt,
      responseJson: extracted.parsed
    });
    return extracted.parsed;
  }

  throw new Error("Unsupported receipt format");
}

export async function enqueueImportJob(input: {
  userId: string;
  uploadedFileId: string;
  type: JobType;
}) {
  return prisma.importJob.create({
    data: {
      userId: input.userId,
      uploadedFileId: input.uploadedFileId,
      type: input.type
    }
  });
}

export async function processStatementImport(jobId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId }, include: { uploadedFile: true, user: true } });
  if (!job || !job.uploadedFile) throw new Error("Import job missing file");

  await prisma.importJob.update({ where: { id: jobId }, data: { status: "PROCESSING" } });

  try {
    const candidates = await parseStatementFile(
      job.userId,
      job.id,
      job.uploadedFile.id,
      job.uploadedFile.path,
      job.uploadedFile.mimeType
    );
    const rules = await prisma.classificationRule.findMany({
      where: { userId: job.userId, category: { archivedAt: null } }
    });
    const account = await prisma.account.findFirst({
      where: { userId: job.userId, archivedAt: null },
      orderBy: { createdAt: "asc" }
    });
    if (!account) throw new Error("Create an account before importing statements");

    const baseCurrency = job.user.baseCurrency || env.BASE_CURRENCY;

    for (const row of candidates) {
      const categoryId = applyCategoryRules(row.description, rules);
      const dedupeHash = buildDedupeHash({
        accountId: account.id,
        amountOriginal: row.amount.toFixed(2),
        currency: row.currency,
        date: row.date,
        description: row.description
      });

      const duplicate = await prisma.transaction.findFirst({ where: { userId: job.userId, sourceHash: dedupeHash } });
      const amountBase = await convertAmount(row.amount, row.currency, baseCurrency, new Date(row.date));

      const imported = await prisma.importedTransaction.create({
        data: {
          importJobId: job.id,
          dedupeHash,
          duplicateOfId: duplicate?.id,
          proposedCategoryId: categoryId,
          confidence: categoryId ? 0.85 : 0.45,
          rawPayload: row as unknown as Prisma.InputJsonValue
        }
      });

      if (!duplicate) {
        const transaction = await prisma.transaction.create({
          data: {
            userId: job.userId,
            accountId: account.id,
            categoryId,
            direction: row.direction,
            description: row.description,
            merchantName: row.merchantName || null,
            amountOriginal: row.amount,
            originalCurrency: row.currency,
            amountBase,
            baseCurrency,
            transactionDate: new Date(row.date),
            sourceHash: dedupeHash
          }
        });

        await prisma.importedTransaction.update({ where: { id: imported.id }, data: { transactionId: transaction.id } });
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "NEEDS_REVIEW",
        outputJson: { importedCount: candidates.length }
      }
    });
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorSummary: error instanceof Error ? error.message : "Unknown import failure" }
    });
    throw error;
  }
}

export async function processReceiptImport(jobId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId }, include: { uploadedFile: true, user: true } });
  if (!job || !job.uploadedFile) throw new Error("Receipt job missing file");

  await prisma.importJob.update({ where: { id: jobId }, data: { status: "PROCESSING" } });

  try {
    const receipt = await parseReceiptFile(
      job.userId,
      job.id,
      job.uploadedFile.id,
      job.uploadedFile.path,
      job.uploadedFile.mimeType
    );
    const rules = await prisma.classificationRule.findMany({
      where: { userId: job.userId, category: { archivedAt: null } }
    });
    const account = await prisma.account.findFirst({ where: { userId: job.userId, archivedAt: null } });
    if (!account) throw new Error("Create an account before importing receipts");

    const baseCurrency = job.user.baseCurrency || env.BASE_CURRENCY;
    const categoryId = applyCategoryRules(receipt.merchantName || "", rules);
    const amountBase = await convertAmount(receipt.total, receipt.currency, baseCurrency, new Date(receipt.date));
    const dedupeHash = buildDedupeHash({
      accountId: account.id,
      amountOriginal: receipt.total.toFixed(2),
      currency: receipt.currency,
      date: receipt.date,
      description: receipt.merchantName || "Receipt"
    });

    const transaction = await prisma.transaction.create({
      data: {
        userId: job.userId,
        accountId: account.id,
        categoryId,
        direction: "EXPENSE",
        description: receipt.merchantName || "Receipt Expense",
        merchantName: receipt.merchantName,
        amountOriginal: receipt.total,
        originalCurrency: receipt.currency,
        amountBase,
        baseCurrency,
        transactionDate: new Date(receipt.date),
        sourceHash: dedupeHash,
        notes: null
      }
    });

    await prisma.importedTransaction.create({
      data: {
        importJobId: job.id,
        transactionId: transaction.id,
        dedupeHash,
        confidence: 0.82,
        rawPayload: receipt as unknown as Prisma.InputJsonValue,
        proposedCategoryId: categoryId
      }
    });

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "NEEDS_REVIEW",
        outputJson: receipt as unknown as Prisma.InputJsonValue
      }
    });
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorSummary: error instanceof Error ? error.message : "Unknown receipt failure" }
    });
    throw error;
  }
}
