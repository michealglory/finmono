import { describe, expect, it } from "vitest";
import { buildDedupeHash } from "@/server/services/dedupe";

describe("dedupe hash", () => {
  it("is stable for canonical-equivalent values", () => {
    const a = buildDedupeHash({
      accountId: "acc-1",
      amountOriginal: "2200.00",
      currency: "ngn",
      date: "2026-02-11T10:00:00.000Z",
      description: " POS Purchase "
    });

    const b = buildDedupeHash({
      accountId: "acc-1",
      amountOriginal: "2200.00",
      currency: "NGN",
      date: "2026-02-11",
      description: "pos purchase"
    });

    expect(a).toBe(b);
  });

  it("changes when key fields differ", () => {
    const a = buildDedupeHash({
      accountId: "acc-1",
      amountOriginal: "2200.00",
      currency: "NGN",
      date: "2026-02-11",
      description: "pos purchase"
    });

    const b = buildDedupeHash({
      accountId: "acc-2",
      amountOriginal: "2200.00",
      currency: "NGN",
      date: "2026-02-11",
      description: "pos purchase"
    });

    expect(a).not.toBe(b);
  });
});
