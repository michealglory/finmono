import { NextResponse } from "next/server";
import { Direction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { resolveDateRange, type RangePreset } from "@/server/services/date-range";
import { convertAmount } from "@/server/services/fx";

function keyByDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const url = new URL(request.url);
  const preset = (url.searchParams.get("preset") || "month") as RangePreset;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const displayCurrency = (url.searchParams.get("currency") || "NGN").toUpperCase();

  const { start, end } = resolveDateRange(preset, from, to);

  const [userRecord, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.userId } }),
    prisma.transaction.findMany({
      where: {
        userId: user.userId,
        transactionDate: {
          gte: start,
          lte: end
        }
      },
      include: {
        category: { include: { parent: true } },
        account: true
      },
      orderBy: { transactionDate: "asc" }
    })
  ]);

  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const baseCurrency = userRecord.baseCurrency;

  let income = 0;
  let expense = 0;
  const perAccount = new Map<string, { name: string; income: number; expense: number }>();
  const categoryTotals = new Map<string, number>();
  const merchantTotals = new Map<string, number>();
  const trendMap = new Map<string, { income: number; expense: number }>();

  for (const tx of transactions) {
    const amountInDisplay =
      displayCurrency === tx.baseCurrency
        ? Number(tx.amountBase)
        : await convertAmount(Number(tx.amountBase), tx.baseCurrency, displayCurrency, tx.transactionDate);

    if (tx.direction === Direction.INCOME) income += amountInDisplay;
    if (tx.direction === Direction.EXPENSE) expense += amountInDisplay;

    const accountNode = perAccount.get(tx.accountId) || { name: tx.account.name, income: 0, expense: 0 };
    if (tx.direction === Direction.INCOME) accountNode.income += amountInDisplay;
    if (tx.direction === Direction.EXPENSE) accountNode.expense += amountInDisplay;
    perAccount.set(tx.accountId, accountNode);

    const majorCategory = tx.category?.parent?.name || tx.category?.name || "Uncategorized";
    if (tx.direction === Direction.EXPENSE) {
      categoryTotals.set(majorCategory, (categoryTotals.get(majorCategory) || 0) + amountInDisplay);
    }

    if (tx.merchantName && tx.direction === Direction.EXPENSE) {
      merchantTotals.set(tx.merchantName, (merchantTotals.get(tx.merchantName) || 0) + amountInDisplay);
    }

    const dayKey = keyByDate(tx.transactionDate);
    const dayNode = trendMap.get(dayKey) || { income: 0, expense: 0 };
    if (tx.direction === Direction.INCOME) dayNode.income += amountInDisplay;
    if (tx.direction === Direction.EXPENSE) dayNode.expense += amountInDisplay;
    trendMap.set(dayKey, dayNode);
  }

  const categoryBreakdown = Array.from(categoryTotals.entries()).map(([name, value]) => ({
    name,
    value: Number(value.toFixed(2)),
    percentOfIncome: income > 0 ? Number(((value / income) * 100).toFixed(2)) : 0
  }));

  categoryBreakdown.sort((a, b) => b.value - a.value);

  const topMerchants = Array.from(merchantTotals.entries())
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const trend = Array.from(trendMap.entries())
    .map(([date, totals]) => ({ date, ...totals, net: totals.income - totals.expense }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    range: { start, end, preset },
    currency: displayCurrency,
    totals: {
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      net: Number((income - expense).toFixed(2))
    },
    perAccount: Array.from(perAccount.entries()).map(([id, value]) => ({ id, ...value })),
    categoryBreakdown,
    topMerchants,
    trend,
    recentTransactions: transactions.slice(-20).reverse()
  });
}
