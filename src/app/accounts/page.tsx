"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/shell";

type Account = { id: string; name: string; currency: string; institution?: string | null; archivedAt?: string | null };

type Impact = { transactions: number };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [impacts, setImpacts] = useState<Record<string, Impact>>({});
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [institution, setInstitution] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCurrency, setEditingCurrency] = useState("NGN");
  const [editingInstitution, setEditingInstitution] = useState("");

  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [deleteStrategy, setDeleteStrategy] = useState<"reassign" | "block">("block");
  const [targetAccountId, setTargetAccountId] = useState("");

  async function load() {
    const res = await fetch("/api/accounts?includeArchived=1");
    const payload = await res.json();
    const loaded = payload.accounts || [];
    setAccounts(loaded);

    const impactEntries = await Promise.all(
      loaded.map(async (account: Account) => {
        const impactRes = await fetch(`/api/accounts/${account.id}/impact`);
        const impactPayload = await impactRes.json();
        return [account.id, impactPayload.counts as Impact] as const;
      })
    );
    setImpacts(Object.fromEntries(impactEntries));
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, currency, institution })
    });

    setName("");
    setInstitution("");
    await load();
  }

  async function saveEdit() {
    if (!editingId) return;
    await fetch(`/api/accounts/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName, currency: editingCurrency, institution: editingInstitution || null })
    });

    setEditingId(null);
    await load();
  }

  async function toggleArchive(account: Account) {
    await fetch(`/api/accounts/${account.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: account.archivedAt ? "unarchive" : "archive" })
    });

    await load();
  }

  async function runDelete() {
    if (!deleteTargetId) return;
    await fetch(`/api/accounts/${deleteTargetId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: deleteStrategy, targetAccountId: deleteStrategy === "reassign" ? targetAccountId : undefined })
    });
    setDeleteTargetId("");
    setTargetAccountId("");
    await load();
  }

  const activeAccounts = accounts.filter((account) => !account.archivedAt);

  return (
    <AppShell title="Accounts">
      <section className="card">
        <h3>Add account</h3>
        <form className="inline-form" onSubmit={onSubmit}>
          <input placeholder="GTBank Naira" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="Institution" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
          <button type="submit">Create</button>
        </form>
      </section>

      <section className="card">
        <h3>Account lifecycle</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Currency</th>
              <th>Institution</th>
              <th>Status</th>
              <th>Impact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>
                  {editingId === account.id ? (
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                  ) : (
                    account.name
                  )}
                </td>
                <td>
                  {editingId === account.id ? (
                    <select value={editingCurrency} onChange={(e) => setEditingCurrency(e.target.value)}>
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                    </select>
                  ) : (
                    account.currency
                  )}
                </td>
                <td>
                  {editingId === account.id ? (
                    <input value={editingInstitution} onChange={(e) => setEditingInstitution(e.target.value)} />
                  ) : (
                    account.institution || "-"
                  )}
                </td>
                <td>{account.archivedAt ? "Archived" : "Active"}</td>
                <td>{impacts[account.id] ? `${impacts[account.id].transactions} transactions` : "..."}</td>
                <td className="inline-form">
                  {editingId === account.id ? (
                    <button type="button" onClick={saveEdit}>Save</button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(account.id);
                        setEditingName(account.name);
                        setEditingCurrency(account.currency);
                        setEditingInstitution(account.institution || "");
                      }}
                    >
                      Edit
                    </button>
                  )}

                  <button type="button" onClick={() => toggleArchive(account)}>
                    {account.archivedAt ? "Restore" : "Archive"}
                  </button>

                  <button type="button" className="danger" onClick={() => setDeleteTargetId(account.id)}>
                    Delete wizard
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {deleteTargetId && (
        <section className="card">
          <h3>Delete account wizard</h3>
          <p>This will reassign transactions (or block deletion) before account removal.</p>
          <div className="grid-form">
            <label>
              Strategy
              <select value={deleteStrategy} onChange={(e) => setDeleteStrategy(e.target.value as "reassign" | "block") }>
                <option value="block">Block when transactions exist</option>
                <option value="reassign">Reassign transactions to another account</option>
              </select>
            </label>

            {deleteStrategy === "reassign" && (
              <label>
                Target account
                <select value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)}>
                  <option value="">Select account</option>
                  {activeAccounts
                    .filter((account) => account.id !== deleteTargetId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>

          <div className="inline-form">
            <button type="button" className="danger" onClick={runDelete}>Confirm delete</button>
            <button type="button" onClick={() => setDeleteTargetId("")}>Cancel</button>
          </div>
        </section>
      )}
    </AppShell>
  );
}
