"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/shell";

type Account = { id: string; name: string; currency: string; institution?: string | null };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [institution, setInstitution] = useState("");

  async function load() {
    const res = await fetch("/api/accounts");
    const payload = await res.json();
    setAccounts(payload.accounts || []);
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
        <h3>My accounts</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Currency</th>
              <th>Institution</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.currency}</td>
                <td>{account.institution || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
