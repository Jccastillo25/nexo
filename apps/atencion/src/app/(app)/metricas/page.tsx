import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { rangoDe, type Metricas } from "@/lib/metricas";
import FiltrosMetricas from "@/components/metricas/filtros";
import ResumenKpis from "@/components/metricas/resumen";
import GraficoPorHora from "@/components/metricas/grafico-por-hora";
import { TablaDias } from "@/components/metricas/tablas";

export const metadata: Metadata = {
  title: "Mis métricas · Atención",
};

export const dynamic = "force-dynamic";

/**
 * Métricas del propio agente (atencion.reportes.mis_metricas.ver, o
 * reportes.turno.ver, que incluye lo propio). Datos de
 * public.atencion_metricas(p_solo_mias = true).
 */
export default async function MisMetricasPage({ searchParams }: PageProps<"/metricas">) {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  const [propias, globales] = await Promise.all([
    hasPermission(ctx, "atencion.reportes.mis_metricas.ver"),
    hasPermission(ctx, "atencion.reportes.turno.ver"),
  ]);
  if (!propias && !globales) redirect("/dashboard");

  const params = await searchParams;
  const { periodo, desde, hasta } = rangoDe(typeof params.periodo === "string" ? params.periodo : undefined);

  const { data, error } = await supabase.rpc("atencion_metricas", {
    p_company_id: companyId,
    p_desde: desde,
    p_hasta: hasta,
    p_solo_mias: true,
  });
  const metricas = data as unknown as Metricas | null;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title="Mis métricas" description="Tus turnos atendidos y tus tiempos de espera y de atención." />
      <FiltrosMetricas ruta="/metricas" periodo={periodo} />
      {error || !metricas ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar tus métricas{error ? `: ${error.message}` : "."}
        </p>
      ) : (
        <>
          <ResumenKpis resumen={metricas.resumen} global={false} />
          <GraficoPorHora
            titulo="Atenciones por hora"
            descripcion="Hora en que empezaste cada atención."
            datos={metricas.por_hora}
            unidad="atenciones"
          />
          {periodo !== "hoy" && <TablaDias filas={metricas.por_dia} />}
        </>
      )}
    </div>
  );
}
