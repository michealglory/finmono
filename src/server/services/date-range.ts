import { endOfDay, endOfMonth, endOfWeek, endOfYear, startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";

export type RangePreset = "day" | "week" | "month" | "year" | "custom";

export function resolveDateRange(preset: RangePreset, from?: string | null, to?: string | null) {
  const now = new Date();

  if (preset === "custom" && from && to) {
    return { start: startOfDay(new Date(from)), end: endOfDay(new Date(to)) };
  }

  if (preset === "day") return { start: startOfDay(now), end: endOfDay(now) };
  if (preset === "week") return { start: startOfWeek(now), end: endOfWeek(now) };
  if (preset === "year") return { start: startOfYear(now), end: endOfYear(now) };

  return { start: startOfMonth(now), end: endOfMonth(now) };
}
