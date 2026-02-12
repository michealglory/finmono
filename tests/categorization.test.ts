import { describe, expect, it } from "vitest";
import { applyCategoryRules } from "@/server/services/categorization";

describe("categorization rules", () => {
  it("applies highest-priority matching rule", () => {
    const result = applyCategoryRules("Bought fish and rice", [
      { categoryId: "cat-2", keyword: "fish", priority: 40 },
      { categoryId: "cat-1", keyword: "fish", priority: 5 }
    ]);

    expect(result).toBe("cat-1");
  });

  it("returns null when no rule matches", () => {
    const result = applyCategoryRules("Salary payment", [{ categoryId: "cat-1", keyword: "fuel", priority: 10 }]);
    expect(result).toBeNull();
  });
});
