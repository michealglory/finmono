import { NextResponse } from "next/server";
import { z } from "zod";
import { Direction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { convertAmount } from "@/server/services/fx";
import { buildTransactionWhere } from "@/server/services/transaction-filters";

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
  notes: z.string().optional().nullable()
});

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const categoryId = url.searchParams.get("categoryId");
  const directionParam = url.searchParams.get("direction");
  const includeDeleted = url.searchParams.get("includeDeleted") === "1";
  const deletedOnly = url.searchParams.get("deletedOnly") === "1";
  const q = url.searchParams.get("q");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 25)));

  const direction = directionParam === Direction.INCOME || directionParam === Direction.EXPENSE ? directionParam : null;

  const where = buildTransactionWhere(user.userId, {
    accountId,
    categoryId,
    direction: direction as Direction | null,
    includeDeleted,
    q,
    from,
    to
  });

  if (deletedOnly) {
    where.deletedAt = { not: null };
  }

  const [totalCount, transactions] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: {
        account: true,
        category: { include: { parent: true } }
      },
      orderBy: { transactionDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return NextResponse.json({
    transactions,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize))
    }
  });
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
  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: user.userId, archivedAt: null }
  });
  if (!account) {
    return NextResponse.json({ error: "Account is invalid or archived" }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: user.userId, archivedAt: null }
    });
    if (!category) {
      return NextResponse.json({ error: "Category is invalid or archived" }, { status: 400 });
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
      notes: parsed.data.notes || null
    }
  });

  return NextResponse.json({ transaction }, { status: 201 });
}
