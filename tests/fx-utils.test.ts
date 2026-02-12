import { describe, expect, it } from "vitest";
import { applyRate, normalizeFxDay } from "@/server/services/fx-utils";

describe("fx utils", () => {
  it("normalizes to UTC day", () => {
    const result = normalizeFxDay(new Date("2026-02-12T23:59:59.000Z"));
    expect(result.toISOString()).toBe("2026-02-12T00:00:00.000Z");
  });

  it("applies fx rate with currency precision", () => {
    expect(applyRate(100, 1520.4567)).toBe(152045.67);
  });
});
