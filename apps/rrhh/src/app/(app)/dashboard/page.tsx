import type { Metadata } from "next";
import { StatCard } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export const metadata: Metadata = {
  title: "Dashboard · RRHH",
};

/**
 * Regla obligatoria (CLAUDE.md): la raiz del modulo aterriza siempre en
 * este Dashboard de KPIs — nunca una lista de contenido ni una pantalla
 * en blanco. Patron "KPI tile" (StatCard + .nexo-glass), alta densidad —
 * ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md §4.2.
 *
 * Requiere que "rrhh" este expuesto en Data API (Settings > API > Data
 * API > Exposed schemas) — ver .env.local.example. Sin ese paso manual,
 * estas queries fallan con 404/"schema not found" (mismo aviso que
 * apps/crm tiene para "crm").
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [empleadosActivos, marcasHoy, planillasPendientes] = await Promise.all([
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("estado", "activo"),
    supabase
      .schema("rrhh")
      .from("asistencia_marcas")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("marcado_en", startOfDay.toISOString()),
    supabase
      .schema("rrhh")
      .from("planillas")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("estado", "borrador"),
  ]);

  const firstError =
    empleadosActivos.error ?? marcasHoy.error ?? planillasPendientes.error;
  if (firstError) {
    throw new Error(`No se pudo cargar el dashboard: ${firstError.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Empleados activos"
          value={empleadosActivos.count ?? 0}
        />
        <StatCard label="Marcas del día" value={marcasHoy.count ?? 0} />
        <StatCard
          label="Planillas pendientes"
          value={planillasPendientes.count ?? 0}
          hint={
            (planillasPendientes.count ?? 0) > 0
              ? "En borrador, sin aprobar"
              : undefined
          }
          accentClassName={
            (planillasPendientes.count ?? 0) > 0 ? "text-amber-400" : undefined
          }
        />
      </div>
    </div>
  );
}
