import { Direction, Prisma } from "@prisma/client";

export type TransactionFilterInput = {
  accountId?: string | null;
  categoryId?: string | null;
  direction?: Direction | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
  includeDeleted?: boolean;
};

export function buildTransactionWhere(userId: string, filters: TransactionFilterInput = {}): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };

  if (!filters.includeDeleted) {
    where.deletedAt = null;
  }

  if (filters.accountId) {
    where.accountId = filters.accountId;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.direction) {
    where.direction = filters.direction;
  }

  const fromDate = parseDateStart(filters.from);
  const toDate = parseDateEnd(filters.to);
  if (fromDate || toDate) {
    where.transactionDate = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {})
    };
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { merchantName: { contains: q, mode: "insensitive" } }
    ];
  }

  return where;
}

function parseDateStart(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateEnd(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
