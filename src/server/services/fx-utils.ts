export function normalizeFxDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function applyRate(amount: number, rate: number): number {
  return Number((amount * rate).toFixed(2));
}
