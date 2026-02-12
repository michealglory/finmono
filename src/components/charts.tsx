"use client";

import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

const colors = ["#005f73", "#0a9396", "#94d2bd", "#ee9b00", "#ca6702", "#bb3e03", "#ae2012"];

export function TrendChart({ data }: { data: Array<{ date: string; income: number; expense: number }> }) {
  return (
    <div className="card chart-card">
      <h3>Cashflow Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="income" stroke="#0a9396" fill="#94d2bd" />
          <Area type="monotone" dataKey="expense" stroke="#bb3e03" fill="#ee9b00" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryPie({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="card chart-card">
      <h3>Category Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
