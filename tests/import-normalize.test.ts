import { describe, expect, it } from "vitest";
import { normalizeRowToCandidate } from "@/server/services/imports";

describe("normalizeRowToCandidate", () => {
  it("parses income from credit when debit is zero", () => {
    const candidate = normalizeRowToCandidate({
      date: "2026-02-12",
      description: "Salary Payment",
      debit: "0.00",
      credit: "250000.00",
      currency: "NGN"
    });

    expect(candidate).toMatchObject({
      direction: "INCOME",
      amount: 250000,
      currency: "NGN"
    });
  });

  it("parses expense from debit when debit is positive", () => {
    const candidate = normalizeRowToCandidate({
      date: "2026-02-12",
      description: "Transfer to merchant",
      debit: "12500.00",
      credit: "0.00",
      currency: "NGN"
    });

    expect(candidate).toMatchObject({
      direction: "EXPENSE",
      amount: 12500,
      currency: "NGN"
    });
  });

  it("falls back to signed amount when debit and credit are unavailable", () => {
    const income = normalizeRowToCandidate({
      date: "2026-02-12",
      description: "Refund",
      amount: "5000",
      currency: "NGN"
    });

    const expense = normalizeRowToCandidate({
      date: "2026-02-12",
      description: "Card spend",
      amount: "-3400",
      currency: "NGN"
    });

    expect(income).toMatchObject({ direction: "INCOME", amount: 5000 });
    expect(expense).toMatchObject({ direction: "EXPENSE", amount: 3400 });
  });
});
