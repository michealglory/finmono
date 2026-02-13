import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  account: {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  transaction: {
    count: vi.fn(),
    updateMany: vi.fn()
  }
};

const prismaMock = {
  account: {
    count: vi.fn()
  },
  $transaction: vi.fn(async (cb: (arg: typeof tx) => unknown) => cb(tx))
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("account management", () => {
  beforeEach(() => {
    Object.values(tx).forEach((entry) => {
      Object.values(entry).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset());
    });
    prismaMock.account.count.mockReset();
  });

  it("reassign delete strategy moves transactions before deleting account", async () => {
    tx.account.findFirst
      .mockResolvedValueOnce({ id: "acc-a", userId: "user-1" })
      .mockResolvedValueOnce({ id: "acc-b", userId: "user-1", archivedAt: null });
    tx.transaction.count.mockResolvedValue(5);

    const { deleteAccountWithStrategy } = await import("@/server/services/account-management");
    await deleteAccountWithStrategy({
      userId: "user-1",
      accountId: "acc-a",
      strategy: "reassign",
      targetAccountId: "acc-b"
    });

    expect(tx.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", accountId: "acc-a" }, data: { accountId: "acc-b" } })
    );
    expect(tx.account.delete).toHaveBeenCalledWith({ where: { id: "acc-a" } });
  });

  it("block strategy throws when account has transactions", async () => {
    tx.account.findFirst.mockResolvedValueOnce({ id: "acc-a", userId: "user-1" });
    tx.transaction.count.mockResolvedValue(2);

    const { deleteAccountWithStrategy } = await import("@/server/services/account-management");
    await expect(
      deleteAccountWithStrategy({ userId: "user-1", accountId: "acc-a", strategy: "block" })
    ).rejects.toThrow(/Reassign before deleting/);
  });
});
