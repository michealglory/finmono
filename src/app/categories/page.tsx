"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell";

type Category = { id: string; name: string; level: number; parentId?: string | null };
type Rule = { id: string; keyword: string; priority: number; category: { name: string } };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);

  const [name, setName] = useState("");
  const [level, setLevel] = useState(1);
  const [parentId, setParentId] = useState("");

  const [ruleKeyword, setRuleKeyword] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [priority, setPriority] = useState(100);

  async function load() {
    const [c, r] = await Promise.all([fetch("/api/categories"), fetch("/api/rules")]);
    const categoriesPayload = await c.json();
    const rulesPayload = await r.json();
    setCategories(categoriesPayload.categories || []);
    setRules(rulesPayload.rules || []);
  }

  useEffect(() => {
    void load();
  }, []);

  const parentCandidates = useMemo(() => categories.filter((item) => item.level === level - 1), [categories, level]);

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

  return (
    <AppShell title="Categories & Rules">
      <section className="card">
        <h3>Create major/subcategory/item-tag category</h3>
        <form className="inline-form" onSubmit={addCategory}>
          <input placeholder="Feeding" value={name} onChange={(e) => setName(e.target.value)} required />
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            <option value={1}>Major category</option>
            <option value={2}>Subcategory</option>
            <option value={3}>Item tag category</option>
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
            {categories.map((category) => (
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
        <h3>Category hierarchy</h3>
        <table>
          <thead>
            <tr>
              <th>Level</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>{category.level}</td>
                <td>{category.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
