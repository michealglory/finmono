"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell";

type Account = { id: string; name: string; currency: string; archivedAt?: string | null };
type Category = { id: string; name: string; level: number; parentId?: string | null };
type Transaction = {
  id: string;
  description: string;
  direction: "INCOME" | "EXPENSE";
  amountOriginal: string;
  originalCurrency: string;
  transactionDate: string;
  deletedAt?: string | null;
  merchantName?: string | null;
  notes?: string | null;
  account: { id: string; name: string };
  category?: { name: string; parent?: { name: string } | null; id: string } | null;
};

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [description, setDescription] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("NGN");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState<{
    accountId: string;
    categoryId: string;
    direction: "INCOME" | "EXPENSE";
    description: string;
    merchantName: string;
    notes: string;
    amountOriginal: string;
    originalCurrency: string;
    transactionDate: string;
  } | null>(null);

  const loadAll = useCallback(async () => {
    const [a, c, t] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/categories"),
      fetch(`/api/transactions?includeDeleted=${includeDeleted ? "1" : "0"}`)
    ]);
    const accountsPayload = await a.json();
    const categoriesPayload = await c.json();
    const transactionsPayload = await t.json();

    setAccounts(accountsPayload.accounts || []);
    setCategories(categoriesPayload.categories || []);
    setTransactions(transactionsPayload.transactions || []);
    if (!accountId && accountsPayload.accounts?.[0]?.id) setAccountId(accountsPayload.accounts[0].id);
  }, [accountId, includeDeleted]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function addTransaction(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        categoryId: categoryId || null,
        direction,
        description,
        merchantName,
        notes,
        amountOriginal: Number(amount),
        originalCurrency: currency,
        transactionDate
      })
    });

    setDescription("");
    setMerchantName("");
    setNotes("");
    setAmount("0");
    await loadAll();
  }

  async function saveEdit() {
    if (!editingId || !editPayload) return;

    await fetch(`/api/transactions/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: editPayload.accountId,
        categoryId: editPayload.categoryId || null,
        direction: editPayload.direction,
        description: editPayload.description,
        merchantName: editPayload.merchantName || null,
        notes: editPayload.notes || null,
        amountOriginal: Number(editPayload.amountOriginal),
        originalCurrency: editPayload.originalCurrency,
        transactionDate: editPayload.transactionDate
      })
    });

    setEditingId(null);
    setEditPayload(null);
    await loadAll();
  }

  async function deleteTransaction(transactionId: string) {
    await fetch(`/api/transactions/${transactionId}`, { method: "DELETE" });
    await loadAll();
  }

  async function restoreTransactionRow(transactionId: string) {
    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true })
    });
    await loadAll();
  }

  return (
    <AppShell title="Transactions">
      <section className="card">
        <h3>Manual entry</h3>
        <form className="grid-form" onSubmit={addTransaction}>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {"-".repeat(Math.max(0, category.level - 1))} {category.name}
              </option>
            ))}
          </select>

          <select value={direction} onChange={(e) => setDirection(e.target.value as "INCOME" | "EXPENSE")}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>

          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
          <input placeholder="Merchant" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
          <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
          <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required />
          <button type="submit">Save transaction</button>
        </form>
      </section>

      <section className="card">
        <h3>Transaction lifecycle</h3>
        <div className="inline-form">
          <label>
            Show deleted
            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>
                  {editingId === tx.id ? (
                    <input
                      type="date"
                      value={editPayload?.transactionDate || tx.transactionDate.slice(0, 10)}
                      onChange={(e) =>
                        setEditPayload((current) =>
                          current
                            ? {
                                ...current,
                                transactionDate: e.target.value
                              }
                            : null
                        )
                      }
                    />
                  ) : (
                    tx.transactionDate.slice(0, 10)
                  )}
                </td>
                <td>
                  {editingId === tx.id ? (
                    <select
                      value={editPayload?.accountId || tx.account.id}
                      onChange={(e) => setEditPayload((current) => (current ? { ...current, accountId: e.target.value } : null))}
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    tx.account.name
                  )}
                </td>
                <td>
                  {editingId === tx.id ? (
                    <select
                      value={editPayload?.categoryId || ""}
                      onChange={(e) => setEditPayload((current) => (current ? { ...current, categoryId: e.target.value } : null))}
                    >
                      <option value="">No category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {"-".repeat(Math.max(0, category.level - 1))} {category.name}
                        </option>
                      ))}
                    </select>
                  ) : tx.category?.parent?.name ? (
                    `${tx.category.parent.name} / ${tx.category.name}`
                  ) : (
                    tx.category?.name || "-"
                  )}
                </td>
                <td>
                  {editingId === tx.id ? (
                    <div className="grid-form">
                      <input
                        value={editPayload?.description || ""}
                        onChange={(e) => setEditPayload((current) => (current ? { ...current, description: e.target.value } : null))}
                      />
                      <input
                        value={editPayload?.merchantName || ""}
                        onChange={(e) => setEditPayload((current) => (current ? { ...current, merchantName: e.target.value } : null))}
                        placeholder="Merchant"
                      />
                      <input
                        value={editPayload?.notes || ""}
                        onChange={(e) => setEditPayload((current) => (current ? { ...current, notes: e.target.value } : null))}
                        placeholder="Notes"
                      />
                    </div>
                  ) : (
                    tx.description
                  )}
                </td>
                <td>
                  {editingId === tx.id ? (
                    <div className="inline-form">
                      <input
                        type="number"
                        step="0.01"
                        value={editPayload?.amountOriginal || tx.amountOriginal}
                        onChange={(e) =>
                          setEditPayload((current) => (current ? { ...current, amountOriginal: e.target.value } : null))
                        }
                      />
                      <select
                        value={editPayload?.originalCurrency || tx.originalCurrency}
                        onChange={(e) =>
                          setEditPayload((current) => (current ? { ...current, originalCurrency: e.target.value } : null))
                        }
                      >
                        <option value="NGN">NGN</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  ) : (
                    `${tx.originalCurrency} ${tx.amountOriginal}`
                  )}
                </td>
                <td>{tx.deletedAt ? "Deleted" : "Active"}</td>
                <td className="inline-form">
                  {editingId === tx.id ? (
                    <button type="button" onClick={saveEdit}>Save</button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(tx.id);
                        setEditPayload({
                          accountId: tx.account.id,
                          categoryId: tx.category?.id || "",
                          direction: tx.direction,
                          description: tx.description,
                          merchantName: tx.merchantName || "",
                          notes: tx.notes || "",
                          amountOriginal: String(tx.amountOriginal),
                          originalCurrency: tx.originalCurrency,
                          transactionDate: tx.transactionDate.slice(0, 10)
                        });
                      }}
                      disabled={!!tx.deletedAt}
                    >
                      Edit
                    </button>
                  )}

                  {tx.deletedAt ? (
                    <button type="button" onClick={() => restoreTransactionRow(tx.id)}>Restore</button>
                  ) : (
                    <button type="button" className="danger" onClick={() => deleteTransaction(tx.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
