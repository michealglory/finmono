import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  transaction: {
    count: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn()
  },
  importedTransaction: {
    updateMany: vi.fn()
  },
  category: {
    findFirst: vi.fn()
  },
  $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops))
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("transaction bulk actions", () => {
  beforeEach(() => {
    prismaMock.transaction.count.mockReset();
    prismaMock.transaction.updateMany.mockReset();
    prismaMock.transaction.findMany.mockReset();
    prismaMock.transaction.deleteMany.mockReset();
    prismaMock.importedTransaction.updateMany.mockReset();
    prismaMock.category.findFirst.mockReset();
    prismaMock.$transaction.mockClear();
  });

  it("soft deletes selected transactions and reports skipped count", async () => {
    prismaMock.transaction.count.mockResolvedValue(3);
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 2 });

    const { applyBulkTransactionAction } = await import("@/server/services/transaction-bulk");
    const result = await applyBulkTransactionAction({
      userId: "user-1",
      action: "soft_delete",
      selection: { mode: "explicit_ids", ids: ["tx-1", "tx-2", "tx-3"] }
    });

    expect(result).toEqual({ matchedCount: 3, updatedCount: 2, skippedCount: 1 });
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ deletedAt: null })])
        })
      })
    );
  });

  it("assigns category to all filtered transactions", async () => {
    prismaMock.category.findFirst.mockResolvedValue({ id: "cat-1", userId: "user-1" });
    prismaMock.transaction.count.mockResolvedValue(4);
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 4 });

    const { applyBulkTransactionAction } = await import("@/server/services/transaction-bulk");
    const result = await applyBulkTransactionAction({
      userId: "user-1",
      action: "assign_category",
      selection: {
        mode: "all_filtered",
        filters: {
          accountId: "acc-1",
          includeDeleted: false,
          direction: "EXPENSE",
          q: "airtime"
        }
      },
      data: { categoryId: "cat-1" }
    });

    expect(result).toEqual({ matchedCount: 4, updatedCount: 4, skippedCount: 0 });
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "cat-1", userId: "user-1", archivedAt: null }) })
    );
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { categoryId: "cat-1" }
      })
    );
  });

  it("restores only deleted transactions", async () => {
    prismaMock.transaction.count.mockResolvedValue(2);
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 1 });

    const { applyBulkTransactionAction } = await import("@/server/services/transaction-bulk");
    const result = await applyBulkTransactionAction({
      userId: "user-1",
      action: "restore",
      selection: { mode: "explicit_ids", ids: ["tx-1", "tx-2"] }
    });

    expect(result).toEqual({ matchedCount: 2, updatedCount: 1, skippedCount: 1 });
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              deletedAt: { not: null }
            })
          ])
        })
      })
    );
  });

  it("rejects assign category when target is invalid", async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);

    const { applyBulkTransactionAction } = await import("@/server/services/transaction-bulk");
    await expect(
      applyBulkTransactionAction({
        userId: "user-1",
        action: "assign_category",
        selection: { mode: "explicit_ids", ids: ["tx-1"] },
        data: { categoryId: "cat-x" }
      })
    ).rejects.toThrow(/invalid or archived/i);
  });

  it("permanently deletes only deleted transactions and detaches import rows", async () => {
    prismaMock.transaction.count.mockResolvedValue(3);
    prismaMock.transaction.findMany.mockResolvedValue([{ id: "tx-1" }, { id: "tx-2" }]);
    prismaMock.importedTransaction.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 2 });

    const { applyBulkTransactionAction } = await import("@/server/services/transaction-bulk");
    const result = await applyBulkTransactionAction({
      userId: "user-1",
      action: "permanent_delete",
      selection: { mode: "explicit_ids", ids: ["tx-1", "tx-2", "tx-3"] }
    });

    expect(result).toEqual({ matchedCount: 3, updatedCount: 2, skippedCount: 1 });
  });
});
