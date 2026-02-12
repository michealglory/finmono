import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findMany }
  }
}));

vi.mock("@/server/auth/require-user", () => ({
  requireUser: vi.fn(async () => ({ user: { userId: "user-1", email: "qa@example.com" }, response: null }))
}));

describe("categories API", () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it("excludes archived categories from default picker feed", async () => {
    const { GET } = await import("@/app/api/categories/route");
    await GET(new Request("http://localhost/api/categories"));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", archivedAt: null })
      })
    );
  });

  it("allows includeArchived=1 for manager views", async () => {
    const { GET } = await import("@/app/api/categories/route");
    await GET(new Request("http://localhost/api/categories?includeArchived=1"));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" })
      })
    );
  });
});
