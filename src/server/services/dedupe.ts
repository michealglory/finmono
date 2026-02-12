import crypto from "node:crypto";

export type DedupeInput = {
  accountId: string;
  amountOriginal: string;
  currency: string;
  date: string;
  description: string;
};

export function buildDedupeHash(input: DedupeInput): string {
  const canonical = [
    input.accountId,
    input.amountOriginal,
    input.currency.toUpperCase(),
    input.date.slice(0, 10),
    input.description.trim().toLowerCase()
  ].join("|");

  return crypto.createHash("sha256").update(canonical).digest("hex");
}
