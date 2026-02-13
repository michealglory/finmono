"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell";
import { CategoryPie, TrendChart } from "@/components/charts";

type DashboardResponse = {
  currency: string;
  totals: { income: number; expense: number; net: number };
  perAccount: Array<{ id: string; name: string; income: number; expense: number }>;
  categoryBreakdown: Array<{ name: string; value: number; percentOfIncome: number }>;
  topMerchants: Array<{ name: string; value: number }>;
  trend: Array<{ date: string; income: number; expense: number }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    amountOriginal: string;
    originalCurrency: string;
    transactionDate: string;
    category?: { name: string; parent?: { name: string } } | null;
  }>;
};

export default function DashboardPage() {
  const [preset, setPreset] = useState("month");
  const [currency, setCurrency] = useState("NGN");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    const query = new URLSearchParams({ preset, currency });
    if (preset === "custom" && from && to) {
      query.set("from", from);
      query.set("to", to);
    }

    fetch(`/api/dashboard?${query.toString()}`)
      .then((res) => res.json())
      .then((payload) => setData(payload));
  }, [preset, currency, from, to]);

  const cards = useMemo(
    () => [
      { label: "Income", value: data?.totals.income ?? 0 },
      { label: "Expenses", value: data?.totals.expense ?? 0 },
      { label: "Net", value: data?.totals.net ?? 0 }
    ],
    [data]
  );

  return (
    <AppShell title="Dashboard">
      <section className="toolbar card">
        <div>
          <label>Time</label>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        <div>
          <label>Display Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
        </div>
        {preset === "custom" && (
          <>
            <div>
              <label>From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label>To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}
      </section>

      <section className="stat-grid">
        {cards.map((card) => (
          <article key={card.label} className="card stat-card">
            <h3>{card.label}</h3>
            <p>
              {data?.currency || "NGN"} {card.value.toLocaleString()}
            </p>
          </article>
        ))}
      </section>

      <section className="chart-grid">
        <TrendChart data={data?.trend || []} />
        <CategoryPie data={data?.categoryBreakdown || []} />
      </section>

      <section className="table-grid">
        <div className="card">
          <h3>Per Account Totals</h3>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Income</th>
                <th>Expense</th>
              </tr>
            </thead>
            <tbody>
              {(data?.perAccount || []).map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.income.toFixed(2)}</td>
                  <td>{row.expense.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>% of Income by Major Category</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Amount</th>
                <th>% Income</th>
              </tr>
            </thead>
            <tbody>
              {(data?.categoryBreakdown || []).map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.value.toFixed(2)}</td>
                  <td>{row.percentOfIncome.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Top Merchants</h3>
          <table>
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Spend</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topMerchants || []).map((merchant) => (
                <tr key={merchant.name}>
                  <td>{merchant.name}</td>
                  <td>{merchant.value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
