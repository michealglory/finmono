"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/shell";

type Tag = {
  id: string;
  name: string;
  color?: string | null;
  archivedAt?: string | null;
};

type Impact = {
  transactions: number;
  lineItems: number;
};

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [impacts, setImpacts] = useState<Record<string, Impact>>({});
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0a9396");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [mergeFromId, setMergeFromId] = useState("");
  const [mergeToId, setMergeToId] = useState("");

  async function load() {
    const response = await fetch("/api/tags?includeArchived=1");
    const payload = await response.json();
    const loadedTags = payload.tags || [];
    setTags(loadedTags);

    const impactEntries = await Promise.all(
      loadedTags.map(async (tag: Tag) => {
        const impactRes = await fetch(`/api/tags/${tag.id}/impact`);
        const impactPayload = await impactRes.json();
        return [tag.id, impactPayload.counts as Impact] as const;
      })
    );

    setImpacts(Object.fromEntries(impactEntries));
  }

  useEffect(() => {
    void load();
  }, []);

  async function addTag(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color })
    });
    setName("");
    await load();
  }

  async function saveEdit(tagId: string) {
    await fetch(`/api/tags/${tagId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName })
    });
    setEditingId(null);
    setEditingName("");
    await load();
  }

  async function deleteTag(tagId: string) {
    await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
    await load();
  }

  async function mergeTag() {
    if (!mergeFromId || !mergeToId) return;
    await fetch(`/api/tags/${mergeFromId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTagId: mergeToId })
    });
    setMergeFromId("");
    setMergeToId("");
    await load();
  }

  return (
    <AppShell title="Tags Manager">
      <section className="card">
        <h3>Create tag</h3>
        <form className="inline-form" onSubmit={addTag}>
          <input placeholder="Essential" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          <button type="submit">Add tag</button>
        </form>
      </section>

      <section className="card">
        <h3>Merge tags</h3>
        <div className="inline-form">
          <select value={mergeFromId} onChange={(e) => setMergeFromId(e.target.value)}>
            <option value="">Source tag</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>

          <select value={mergeToId} onChange={(e) => setMergeToId(e.target.value)}>
            <option value="">Target tag</option>
            {tags
              .filter((tag) => tag.id !== mergeFromId)
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
          </select>

          <button type="button" onClick={mergeTag}>Merge</button>
        </div>
      </section>

      <section className="card">
        <h3>Tag lifecycle</h3>
        <table>
          <thead>
            <tr>
              <th>Tag</th>
              <th>Color</th>
              <th>Impact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id}>
                <td>
                  {editingId === tag.id ? (
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                  ) : (
                    tag.name
                  )}
                </td>
                <td>
                  <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 4, background: tag.color || "#ddd" }} />
                </td>
                <td>
                  {impacts[tag.id]
                    ? `${impacts[tag.id].transactions} transactions, ${impacts[tag.id].lineItems} line items`
                    : "..."}
                </td>
                <td className="inline-form">
                  {editingId === tag.id ? (
                    <button type="button" onClick={() => saveEdit(tag.id)}>Save</button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(tag.id);
                        setEditingName(tag.name);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  <button type="button" className="danger" onClick={() => deleteTag(tag.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
