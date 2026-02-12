import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { convertAmount } from "@/server/services/fx";

const createSchema = z.object({
  accountId: z.string(),
  categoryId: z.string().optional().nullable(),
  direction: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().min(2),
  merchantName: z.string().optional().nullable(),
  amountOriginal: z.number().positive(),
  originalCurrency: z.string().min(3).max(3),
  baseCurrency: z.string().min(3).max(3).optional(),
  transactionDate: z.string(),
  notes: z.string().optional().nullable(),
  tagIds: z.array(z.string()).optional()
});

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.userId,
      ...(accountId ? { accountId } : {})
    },
    include: {
      account: true,
      category: { include: { parent: true } },
      lineItems: { include: { tags: { include: { tag: true } } } },
      tags: { include: { tag: true } }
    },
    orderBy: { transactionDate: "desc" },
    take: 300
  });

  return NextResponse.json({ transactions });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userRecord = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const transactionDate = new Date(parsed.data.transactionDate);
  const baseCurrency = parsed.data.baseCurrency || userRecord.baseCurrency;
  if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
    const ownedTags = await prisma.tag.count({
      where: { userId: user.userId, id: { in: parsed.data.tagIds }, archivedAt: null }
    });
    if (ownedTags !== parsed.data.tagIds.length) {
      return NextResponse.json({ error: "One or more tags are invalid/archived" }, { status: 400 });
    }
  }

  const amountBase = await convertAmount(
    parsed.data.amountOriginal,
    parsed.data.originalCurrency.toUpperCase(),
    baseCurrency.toUpperCase(),
    transactionDate
  );

  const transaction = await prisma.transaction.create({
    data: {
      userId: user.userId,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId || null,
      direction: parsed.data.direction,
      description: parsed.data.description,
      merchantName: parsed.data.merchantName || null,
      amountOriginal: parsed.data.amountOriginal,
      originalCurrency: parsed.data.originalCurrency.toUpperCase(),
      amountBase,
      baseCurrency: baseCurrency.toUpperCase(),
      transactionDate,
      notes: parsed.data.notes || null,
      ...(parsed.data.tagIds && parsed.data.tagIds.length > 0
        ? {
            tags: {
              create: parsed.data.tagIds.map((tagId) => ({
                tag: { connect: { id: tagId } }
              }))
            }
          }
        : {})
    }
  });

  return NextResponse.json({ transaction }, { status: 201 });
}
