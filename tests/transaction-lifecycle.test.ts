import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: { updateMany }
  }
}));

describe("transaction lifecycle", () => {
  beforeEach(() => {
    updateMany.mockReset();
  });

  it("soft delete sets deletedAt", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const { softDeleteTransaction } = await import("@/server/services/transaction-lifecycle");
    await softDeleteTransaction("user-1", "tx-1");

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tx-1", userId: "user-1", deletedAt: null } })
    );
  });

  it("restore clears deletedAt", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const { restoreTransaction } = await import("@/server/services/transaction-lifecycle");
    await restoreTransaction("user-1", "tx-1");

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tx-1", userId: "user-1" }, data: { deletedAt: null } })
    );
  });
});
