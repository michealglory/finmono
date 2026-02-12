import type { ClassificationRule } from "@prisma/client";

type RuleLike = Pick<ClassificationRule, "keyword" | "categoryId" | "priority">;

export function applyCategoryRules(description: string, rules: RuleLike[]): string | null {
  const normalized = description.toLowerCase();
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (normalized.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId;
    }
  }

  return null;
}
