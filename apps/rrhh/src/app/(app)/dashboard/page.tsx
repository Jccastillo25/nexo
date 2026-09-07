import type { Metadata } from "next";
import { MetricCard, PageHeader, ActivityFeed, QuickActions } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export const metadata: Metadata = {
  title: "Dashboard · RRHH",
};

/**
 * Regla obligatoria (CLAUDE.md): la raiz del modulo aterriza siempre en
 * este Dashboard de KPIs — nunca una lista de contenido ni una pantalla
 * en blanco. Nexo Enterprise UI (2026-09-07): MetricCard claro reemplaza
 * a StatCard (dark/glass, retirado). "Contratos activos" es nuevo (real,
 * ya consultable via rrhh.contratos); "Marcas del día" y "Planillas
 * pendientes" ya eran reales antes del rediseño y se conservan tal cual —
 * regla obligatoria "cero datos mock": ningun KPI se inventa.
 *
 * Requiere que "rrhh" este expuesto en Data API (Settings > API > Data
 * API > Exposed schemas) — ver .env.local.example.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [expedientes, contratosActivos, marcasHoy, planillasPendientes] = await Promise.all([
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .schema("rrhh")
      .from("contratos")
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
    expedientes.error ?? contratosActivos.error ?? marcasHoy.error ?? planillasPendientes.error;
  if (firstError) {
    throw new Error(`No se pudo cargar el dashboard: ${firstError.message}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Resumen operativo de RRHH." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Expedientes" value={expedientes.count ?? 0} />
        <MetricCard label="Contratos activos" value={contratosActivos.count ?? 0} tone="positive" />
        <MetricCard label="Marcas del día" value={marcasHoy.count ?? 0} />
        <MetricCard
          label="Planillas pendientes"
          value={planillasPendientes.count ?? 0}
          hint={(planillasPendientes.count ?? 0) > 0 ? "En borrador, sin aprobar" : undefined}
          tone={(planillasPendientes.count ?? 0) > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActivityFeed
          items={[]}
          emptyLabel="Pendiente de consolidación — la línea de tiempo de asistencia llega con F1.5."
        />
        <QuickActions
          actions={[
            { label: "Nuevo empleado", href: "/expedientes/nuevo", icon: "users" },
            { label: "Ver expedientes", href: "/expedientes", icon: "folder" },
            { label: "Jornadas", href: "/jornadas", icon: "calendar" },
            { label: "Feriados", href: "/feriados", icon: "calendar" },
          ]}
        />
      </div>
    </div>
  );
}
