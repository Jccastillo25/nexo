import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, PageHeader } from "@nexo/ui";
import { mensajeAtencion } from "@/lib/errores";
import { permisosDe } from "@/lib/permisos";
import { rangoDe, type Metricas } from "@/lib/metricas";
import type { Database } from "@/lib/supabase/database.types";
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
  const [{ supabase, companyId }, permisos, params] = await Promise.all([
    contextoActual<Database>(),
    permisosDe(),
    searchParams,
  ]);
  if (!permisos.misMetricas && !permisos.reportes) redirect("/dashboard");

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
        <Alert tone="error" title="No se pudieron cargar tus métricas">
          {error
            ? mensajeAtencion(error, "atencion_metricas (mis métricas)", "Intenta de nuevo en unos minutos.")
            : "Intenta de nuevo en unos minutos."}
        </Alert>
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
