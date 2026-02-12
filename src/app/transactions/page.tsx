"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell";

type Account = { id: string; name: string; currency: string };
type Category = { id: string; name: string; level: number; parentId?: string | null };
type Tag = { id: string; name: string };
type Transaction = {
  id: string;
  description: string;
  direction: "INCOME" | "EXPENSE";
  amountOriginal: string;
  originalCurrency: string;
  transactionDate: string;
  account: { name: string };
  category?: { name: string; parent?: { name: string } | null } | null;
  lineItems?: Array<{ id: string; description: string; amountOriginal: string }>;
  tags?: Array<{ tag: { id: string; name: string } }>;
};

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [description, setDescription] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("NGN");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [overrideMap, setOverrideMap] = useState<Record<string, string>>({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const loadAll = useCallback(async () => {
    const [a, c, tg, t] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/categories"),
      fetch("/api/tags"),
      fetch("/api/transactions")
    ]);
    const accountsPayload = await a.json();
    const categoriesPayload = await c.json();
    const tagsPayload = await tg.json();
    const transactionsPayload = await t.json();

    setAccounts(accountsPayload.accounts || []);
    setCategories(categoriesPayload.categories || []);
    setTags(tagsPayload.tags || []);
    setTransactions(transactionsPayload.transactions || []);
    if (!accountId && accountsPayload.accounts?.[0]?.id) setAccountId(accountsPayload.accounts[0].id);
  }, [accountId]);

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
        amountOriginal: Number(amount),
        originalCurrency: currency,
        transactionDate,
        tagIds: selectedTagIds
      })
    });

    setDescription("");
    setMerchantName("");
    setAmount("0");
    setSelectedTagIds([]);
    await loadAll();
  }

  async function overrideCategory(transactionId: string) {
    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: overrideMap[transactionId] || null })
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
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
          <select
            value=""
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              setSelectedTagIds((current) => (current.includes(value) ? current : [...current, value]));
              e.target.value = "";
            }}
          >
            <option value="">Add tag</option>
            {tags
              .filter((tag) => !selectedTagIds.includes(tag.id))
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
          </select>
          <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required />
          <button type="submit">Save transaction</button>
        </form>
        {selectedTagIds.length > 0 && (
          <div className="inline-form">
            {selectedTagIds.map((id) => {
              const tag = tags.find((item) => item.id === id);
              if (!tag) return null;
              return (
                <button key={id} type="button" onClick={() => setSelectedTagIds((current) => current.filter((x) => x !== id))}>
                  {tag.name} ×
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Transaction drill-down</h3>
        <table>
          <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Manual Override</th>
              </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.transactionDate.slice(0, 10)}</td>
                <td>{tx.account.name}</td>
                <td>{tx.category?.parent?.name ? `${tx.category.parent.name} / ${tx.category.name}` : tx.category?.name || "-"}</td>
                <td>
                  {tx.description}
                  {(tx.tags || []).length > 0 && <div>Tags: {tx.tags?.map((entry) => entry.tag.name).join(", ")}</div>}
                  {(tx.lineItems || []).length > 0 && (
                    <ul>
                      {(tx.lineItems || []).map((item) => (
                        <li key={item.id}>
                          {item.description}: {item.amountOriginal}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  {tx.originalCurrency} {tx.amountOriginal}
                </td>
                <td>
                  <div className="inline-form">
                    <select
                      value={overrideMap[tx.id] ?? ""}
                      onChange={(e) => setOverrideMap((current) => ({ ...current, [tx.id]: e.target.value }))}
                    >
                      <option value="">No category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {"-".repeat(Math.max(0, category.level - 1))} {category.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => overrideCategory(tx.id)}>
                      Override
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
