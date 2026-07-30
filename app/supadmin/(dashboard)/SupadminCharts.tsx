"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#f1f5f9",
};

export function DriversByCompanyChart({ data }: { data: { name: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-slate-500">Sin empresas todavía.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis type="number" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
        <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} width={120} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1e293b" }} />
        <Bar dataKey="count" name="Conductores" fill="#fbbf24" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
