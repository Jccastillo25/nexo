import type { Metadata } from "next";
import { MetricCard, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { MiEstado, PuestoEstado, TurnoCola } from "@/lib/supabase/database.types";
import InicioAtencion from "./inicio-atencion";

export const metadata: Metadata = {
  title: "Inicio · Atención",
};

export const dynamic = "force-dynamic";

/**
 * Inicio del módulo: botón "Iniciar / Cerrar atención" (decisión 2026-10-14)
 * y KPIs del día de la sucursal (la de la sesión abierta, o la única
 * asignada). Datos reales de las RPC, nunca de ejemplo.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const { data: estadoRaw, error } = await supabase.rpc("atencion_mi_estado", { p_company_id: companyId });
  const estado = estadoRaw as unknown as MiEstado | null;

  const sucursalId = estado?.sesion?.sucursal_id ?? (estado?.sucursales.length === 1 ? estado.sucursales[0].id : null);
  const sucursalNombre =
    estado?.sesion?.sucursal ?? estado?.sucursales.find((s) => s.id === sucursalId)?.nombre ?? null;

  let cola: TurnoCola[] = [];
  let puestos: PuestoEstado[] = [];
  if (sucursalId) {
    const [colaRes, puestosRes] = await Promise.all([
      supabase.rpc("atencion_cola", { p_company_id: companyId, p_sucursal_id: sucursalId }),
      supabase.rpc("atencion_listar_puestos", { p_company_id: companyId, p_sucursal_id: sucursalId }),
    ]);
    cola = colaRes.data ?? [];
    puestos = puestosRes.data ?? [];
  }

  const enEspera = cola.filter((t) => t.estado === "esperando").length;
  const atendidos = cola.filter((t) => t.estado === "atendido").length;
  const ausentes = cola.filter((t) => t.estado === "ausente").length;
  const activos = puestos.filter((p) => p.activo);
  const ocupados = activos.filter((p) => p.ocupado_por).length;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Atención"
        description={sucursalNombre ? `Turnos de hoy en ${sucursalNombre}.` : "Turnos de sala de espera por sucursal."}
      />

      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cargar tu estado: {error.message}
        </p>
      ) : (
        estado && <InicioAtencion estado={estado} />
      )}

      {sucursalId ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="En espera" value={enEspera} tone={enEspera > 0 ? "warning" : "neutral"} />
          <MetricCard label="Atendidos hoy" value={atendidos} tone="positive" />
          <MetricCard label="Ausentes hoy" value={ausentes} tone={ausentes > 0 ? "negative" : "neutral"} />
          <MetricCard label="Puestos ocupados" value={`${ocupados} / ${activos.length}`} />
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          Las métricas del día aparecen cuando iniciás atención en una sucursal.
        </p>
      )}
    </div>
  );
}
