import { createAdminClient } from "@/lib/supabase/admin";
import { StatCard } from "@/components/StatCard";
import { DriversByCompanyChart } from "./SupadminCharts";

export default async function SupadminDashboardPage() {
  const admin = createAdminClient();

  const [
    { count: totalCompanies },
    { count: activeCompanies },
    { count: totalAdmins },
    { count: activeAdmins },
    { count: totalDrivers },
    { count: activeDrivers },
    { data: companiesWithDrivers },
  ] = await Promise.all([
    admin.from("companies").select("id", { count: "exact", head: true }),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("admins").select("id", { count: "exact", head: true }),
    admin.from("admins").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("drivers").select("id", { count: "exact", head: true }),
    admin.from("drivers").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("companies").select("id, name, drivers(count)").order("name"),
  ]);

  const driversByCompany = (companiesWithDrivers ?? [])
    .map((c) => ({
      name: c.name,
      count: Array.isArray(c.drivers) ? (c.drivers[0]?.count ?? 0) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400">Resumen de toda la plataforma Ruta360.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Empresas" value={totalCompanies ?? 0} />
        <StatCard label="Empresas activas" value={activeCompanies ?? 0} />
        <StatCard label="Administradores" value={totalAdmins ?? 0} />
        <StatCard label="Administradores activos" value={activeAdmins ?? 0} />
        <StatCard label="Conductores" value={totalDrivers ?? 0} />
        <StatCard label="Conductores activos" value={activeDrivers ?? 0} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-lg font-bold text-slate-100">Conductores por empresa</h2>
        <DriversByCompanyChart data={driversByCompany} />
      </div>
    </div>
  );
}
