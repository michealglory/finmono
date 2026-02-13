"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell";

type Category = {
  id: string;
  name: string;
  level: number;
  parentId?: string | null;
  archivedAt?: string | null;
  isSystem?: boolean;
};

type Impact = {
  transactions: number;
  rules: number;
  importRows: number;
  childCategories: number;
};

type Rule = { id: string; keyword: string; priority: number; category: { name: string } };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [impacts, setImpacts] = useState<Record<string, Impact>>({});

  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [parentId, setParentId] = useState("");

  const [ruleKeyword, setRuleKeyword] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [priority, setPriority] = useState(100);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [deleteStrategy, setDeleteStrategy] = useState<"reassign" | "uncategorized">("uncategorized");
  const [deleteTargetCategoryId, setDeleteTargetCategoryId] = useState("");
  const [childStrategy, setChildStrategy] = useState<"reassign" | "archive" | "block">("block");
  const [childTargetCategoryId, setChildTargetCategoryId] = useState("");

  async function load() {
    const [c, r] = await Promise.all([fetch("/api/categories?includeArchived=1"), fetch("/api/rules")]);
    const categoriesPayload = await c.json();
    const rulesPayload = await r.json();
    const loadedCategories = categoriesPayload.categories || [];
    setCategories(loadedCategories);
    setRules(rulesPayload.rules || []);

    const impactEntries = await Promise.all(
      loadedCategories.map(async (category: Category) => {
        const impactRes = await fetch(`/api/categories/${category.id}/impact`);
        const payload = await impactRes.json();
        return [category.id, payload.counts as Impact] as const;
      })
    );

    setImpacts(Object.fromEntries(impactEntries));
  }

  useEffect(() => {
    void load();
  }, []);

  const parentCandidates = useMemo(() => categories.filter((item) => item.level === level - 1 && !item.archivedAt), [categories, level]);
  const topLevelCandidates = useMemo(
    () => categories.filter((item) => item.level === 1 && !item.archivedAt),
    [categories]
  );
  const activeCategories = useMemo(() => categories.filter((item) => !item.archivedAt), [categories]);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: parentId || null, level })
    });

    setName("");
    setParentId("");
    await load();
  }

  async function addRule(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: ruleCategoryId, keyword: ruleKeyword, priority })
    });

    setRuleKeyword("");
    await load();
  }

  async function saveEdit(categoryId: string) {
    await fetch(`/api/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName })
    });
    setEditingId(null);
    setEditingName("");
    await load();
  }

  async function toggleArchive(category: Category) {
    await fetch(`/api/categories/${category.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: category.archivedAt ? "unarchive" : "archive" })
    });
    await load();
  }

  async function runDelete(categoryId: string) {
    await fetch(`/api/categories/${categoryId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy: deleteStrategy,
        targetCategoryId: deleteStrategy === "reassign" ? deleteTargetCategoryId : undefined,
        childStrategy,
        childTargetCategoryId: childStrategy === "reassign" ? childTargetCategoryId : undefined
      })
    });

    setDeleteTargetId("");
    setDeleteTargetCategoryId("");
    setChildTargetCategoryId("");
    setChildStrategy("block");
    await load();
  }

  return (
    <AppShell title="Categories/Subcategories Manager">
      <section className="card">
        <h3>Create category/subcategory</h3>
        <form className="inline-form" onSubmit={addCategory}>
          <input placeholder="Feeding" value={name} onChange={(e) => setName(e.target.value)} required />
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            <option value={1}>Major category</option>
            <option value={2}>Subcategory</option>
          </select>

          {level > 1 && (
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} required>
              <option value="">Select parent</option>
              {parentCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit">Add category</button>
        </form>
      </section>

      <section className="card">
        <h3>Classification rules</h3>
        <form className="inline-form" onSubmit={addRule}>
          <input placeholder="keyword (e.g., fish)" value={ruleKeyword} onChange={(e) => setRuleKeyword(e.target.value)} required />
          <select value={ruleCategoryId} onChange={(e) => setRuleCategoryId(e.target.value)} required>
            <option value="">Map to category</option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          <button type="submit">Save rule</button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Category</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.keyword}</td>
                <td>{rule.category.name}</td>
                <td>{rule.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Tree view and lifecycle actions</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Impact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const impact = impacts[category.id];
              return (
                <tr key={category.id}>
                  <td>
                    {"-".repeat(Math.max(0, category.level - 1))} {editingId === category.id ? (
                      <input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                    ) : (
                      category.name
                    )}
                    {category.isSystem ? " (System)" : ""}
                  </td>
                  <td>{category.archivedAt ? "Archived" : "Active"}</td>
                  <td>
                    {impact
                      ? `${impact.transactions} tx, ${impact.rules} rules, ${impact.importRows} import refs, ${impact.childCategories} children`
                      : "..."}
                  </td>
                  <td className="inline-form">
                    {editingId === category.id ? (
                      <button type="button" onClick={() => saveEdit(category.id)}>
                        Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(category.id);
                          setEditingName(category.name);
                        }}
                        disabled={!!category.isSystem}
                      >
                        Edit
                      </button>
                    )}

                    <button type="button" onClick={() => toggleArchive(category)} disabled={!!category.isSystem}>
                      {category.archivedAt ? "Restore" : "Archive"}
                    </button>

                    <button type="button" className="danger" onClick={() => setDeleteTargetId(category.id)} disabled={!!category.isSystem}>
                      Delete wizard
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {deleteTargetId && (
        <section className="card">
          <h3>Delete wizard</h3>
          <p>
            This action updates all references in transactions, rules, and import mappings inside a DB transaction.
          </p>

          <div className="grid-form">
            <label>
              Reference strategy
              <select value={deleteStrategy} onChange={(e) => setDeleteStrategy(e.target.value as "reassign" | "uncategorized") }>
                <option value="uncategorized">Move to Uncategorized</option>
                <option value="reassign">Reassign to another category</option>
              </select>
            </label>

            {deleteStrategy === "reassign" && (
              <label>
                Reassign target
                <select value={deleteTargetCategoryId} onChange={(e) => setDeleteTargetCategoryId(e.target.value)}>
                  <option value="">Select category</option>
                  {activeCategories
                    .filter((cat) => cat.id !== deleteTargetId)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label>
              Child subcategory strategy
              <select value={childStrategy} onChange={(e) => setChildStrategy(e.target.value as "reassign" | "archive" | "block") }>
                <option value="block">Block until decision</option>
                <option value="archive">Archive child subcategories</option>
                <option value="reassign">Reassign child subcategories to another major</option>
              </select>
            </label>

            {childStrategy === "reassign" && (
              <label>
                Child major target
                <select value={childTargetCategoryId} onChange={(e) => setChildTargetCategoryId(e.target.value)}>
                  <option value="">Select major category</option>
                  {topLevelCandidates
                    .filter((cat) => cat.id !== deleteTargetId)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>

          <div className="inline-form">
            <button type="button" className="danger" onClick={() => runDelete(deleteTargetId)}>
              Confirm delete
            </button>
            <button type="button" onClick={() => setDeleteTargetId("")}>Cancel</button>
          </div>
        </section>
      )}
    </AppShell>
  );
}
