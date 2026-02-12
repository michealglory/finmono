import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  category: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn()
  },
  transaction: { updateMany: vi.fn() },
  transactionLineItem: { updateMany: vi.fn() },
  classificationRule: { updateMany: vi.fn() },
  importedTransaction: { updateMany: vi.fn() }
};

const prismaMock = {
  $transaction: vi.fn(async (cb: (arg: typeof tx) => unknown) => cb(tx))
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("category management delete strategy", () => {
  beforeEach(() => {
    Object.values(tx).forEach((entry) => {
      if (typeof entry === "object") {
        Object.values(entry).forEach((fn) => {
          if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockReset();
        });
      }
    });
    prismaMock.$transaction.mockClear();
  });

  it("reassign strategy updates all dependent rows", async () => {
    tx.category.findFirst
      .mockResolvedValueOnce({ id: "cat-a", userId: "user-1", isSystem: false, children: [] })
      .mockResolvedValueOnce({ id: "cat-b", userId: "user-1", archivedAt: null });

    const { deleteCategoryWithStrategy } = await import("@/server/services/category-management");

    await deleteCategoryWithStrategy({
      userId: "user-1",
      categoryId: "cat-a",
      strategy: "reassign",
      targetCategoryId: "cat-b"
    });

    expect(tx.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { categoryId: "cat-b" } })
    );
    expect(tx.transactionLineItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { categoryId: "cat-b" } })
    );
    expect(tx.classificationRule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { categoryId: "cat-b" } })
    );
    expect(tx.importedTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { proposedCategoryId: "cat-b" } })
    );
    expect(tx.category.delete).toHaveBeenCalledWith({ where: { id: "cat-a" } });
  });

  it("uncategorized strategy creates fallback when missing", async () => {
    tx.category.findFirst
      .mockResolvedValueOnce({ id: "cat-a", userId: "user-1", isSystem: false, children: [] })
      .mockResolvedValueOnce(null);
    tx.category.create.mockResolvedValue({ id: "uncat" });

    const { deleteCategoryWithStrategy } = await import("@/server/services/category-management");

    await deleteCategoryWithStrategy({
      userId: "user-1",
      categoryId: "cat-a",
      strategy: "uncategorized"
    });

    expect(tx.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "uncategorized", isSystem: true }) })
    );
    expect(tx.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { categoryId: "uncat" } })
    );
  });
});
