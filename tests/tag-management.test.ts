import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  tag: {
    findFirst: vi.fn(),
    delete: vi.fn()
  },
  transactionTag: {
    count: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn()
  },
  lineItemTag: {
    count: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn()
  }
};

const prismaMock = {
  $transaction: vi.fn(async (cb: (arg: typeof tx) => unknown) => cb(tx))
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("tag management", () => {
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

  it("delete detaches join rows before removing tag", async () => {
    tx.tag.findFirst.mockResolvedValue({ id: "tag-a", userId: "user-1" });

    const { deleteTag } = await import("@/server/services/tag-management");
    await deleteTag("user-1", "tag-a");

    expect(tx.transactionTag.deleteMany).toHaveBeenCalledWith({ where: { tagId: "tag-a" } });
    expect(tx.lineItemTag.deleteMany).toHaveBeenCalledWith({ where: { tagId: "tag-a" } });
    expect(tx.tag.delete).toHaveBeenCalledWith({ where: { id: "tag-a" } });
  });

  it("merge moves associations and deletes source tag", async () => {
    tx.tag.findFirst.mockResolvedValueOnce({ id: "source", userId: "user-1" }).mockResolvedValueOnce({ id: "target", userId: "user-1" });
    tx.transactionTag.findMany.mockResolvedValue([{ transactionId: "tx-1", tagId: "source" }]);
    tx.lineItemTag.findMany.mockResolvedValue([{ lineItemId: "li-1", tagId: "source" }]);

    const { mergeTag } = await import("@/server/services/tag-management");
    await mergeTag("user-1", "source", "target");

    expect(tx.transactionTag.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ transactionId: "tx-1", tagId: "target" }] })
    );
    expect(tx.lineItemTag.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ lineItemId: "li-1", tagId: "target" }] })
    );
    expect(tx.tag.delete).toHaveBeenCalledWith({ where: { id: "source" } });
  });
});
