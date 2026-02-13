import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { convertAmount } from "@/server/services/fx";
import { restoreTransaction, softDeleteTransaction } from "@/server/services/transaction-lifecycle";

const updateSchema = z.object({
  accountId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  direction: z.enum(["INCOME", "EXPENSE"]).optional(),
  description: z.string().min(2).optional(),
  merchantName: z.string().nullable().optional(),
  amountOriginal: z.number().positive().optional(),
  originalCurrency: z.string().min(3).max(3).optional(),
  transactionDate: z.string().optional(),
  notes: z.string().nullable().optional(),
  restore: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;
  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.restore) {
    try {
      const result = await restoreTransaction(user.userId, params.id);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Restore failed" }, { status: 400 });
    }
  }

  const existing = await prisma.transaction.findFirst({ where: { id: params.id, userId: user.userId } });
  if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const nextAccountId = parsed.data.accountId || existing.accountId;
  const nextCategoryId = parsed.data.categoryId === undefined ? existing.categoryId : parsed.data.categoryId;
  const nextDate = parsed.data.transactionDate ? new Date(parsed.data.transactionDate) : existing.transactionDate;
  const nextCurrency = (parsed.data.originalCurrency || existing.originalCurrency).toUpperCase();
  const nextAmountOriginal = parsed.data.amountOriginal ?? Number(existing.amountOriginal);

  const account = await prisma.account.findFirst({ where: { id: nextAccountId, userId: user.userId, archivedAt: null } });
  if (!account) return NextResponse.json({ error: "Account is invalid or archived" }, { status: 400 });

  if (nextCategoryId) {
    const category = await prisma.category.findFirst({
      where: { id: nextCategoryId, userId: user.userId, archivedAt: null }
    });
    if (!category) return NextResponse.json({ error: "Category is invalid or archived" }, { status: 400 });
  }

  const userRecord = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!userRecord) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const amountBase = await convertAmount(nextAmountOriginal, nextCurrency, userRecord.baseCurrency, nextDate);

  const updated = await prisma.transaction.updateMany({
    where: { id: params.id, userId: user.userId },
    data: {
      accountId: nextAccountId,
      categoryId: nextCategoryId,
      direction: parsed.data.direction,
      description: parsed.data.description,
      merchantName: parsed.data.merchantName,
      amountOriginal: parsed.data.amountOriginal,
      originalCurrency: parsed.data.originalCurrency?.toUpperCase(),
      amountBase,
      baseCurrency: userRecord.baseCurrency,
      transactionDate: parsed.data.transactionDate ? new Date(parsed.data.transactionDate) : undefined,
      notes: parsed.data.notes
    }
  });

  return NextResponse.json({ updated: updated.count });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = await context.params;

  try {
    const result = await softDeleteTransaction(user.userId, params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
