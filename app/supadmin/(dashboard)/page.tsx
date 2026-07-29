import { createAdminClient } from "@/lib/supabase/admin";
import { StatCard } from "@/components/StatCard";
import { UsersByCompanyChart } from "./SupadminCharts";

export default async function SupadminDashboardPage() {
  const admin = createAdminClient();

  const [
    { count: totalCompanies },
    { count: activeCompanies },
    { count: totalUsers },
    { count: activeUsers },
    { data: companies },
  ] = await Promise.all([
    admin.from("companies").select("id", { count: "exact", head: true }),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("companies").select("name, users(count)").order("name"),
  ]);

  const usersByCompany = (companies ?? [])
    .map((c) => ({
      name: c.name,
      count: Array.isArray(c.users) ? (c.users[0]?.count ?? 0) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400">Resumen de toda la plataforma Ruta360.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Empresas" value={totalCompanies ?? 0} />
        <StatCard label="Empresas activas" value={activeCompanies ?? 0} />
        <StatCard label="Usuarios totales" value={totalUsers ?? 0} />
        <StatCard label="Usuarios activos" value={activeUsers ?? 0} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-bold text-slate-100">Usuarios por empresa</h2>
        <UsersByCompanyChart data={usersByCompany} />
      </div>
    </div>
  );
}
