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
import { TablaAgentes, TablaDias, TablaPuestos } from "@/components/metricas/tablas";

export const metadata: Metadata = {
  title: "Reportes · Atención",
};

export const dynamic = "force-dynamic";

/**
 * Dashboard global (atencion.reportes.turno.ver): sucursales permitidas, con
 * desglose por agente, puesto y día. Datos de public.atencion_metricas.
 */
export default async function ReportesPage({ searchParams }: PageProps<"/reportes">) {
  const [{ supabase, companyId }, permisos, params] = await Promise.all([
    contextoActual<Database>(),
    permisosDe(),
    searchParams,
  ]);
  if (!permisos.reportes) redirect("/dashboard");

  const { periodo, desde, hasta } = rangoDe(typeof params.periodo === "string" ? params.periodo : undefined);

  const { data: sucursalesData, error: errorSucursales } = await supabase.rpc("atencion_sucursales_reportes", {
    p_company_id: companyId,
  });
  if (errorSucursales) console.error("atencion_sucursales_reportes", errorSucursales);
  // Sin la lista, el filtro de sucursal no se muestra y el reporte cubre todas las permitidas.
  const sucursales = errorSucursales ? [] : (sucursalesData ?? []);
  const pedida = typeof params.sucursal === "string" ? params.sucursal : null;
  const sucursal = pedida && sucursales.some((s) => s.id === pedida) ? pedida : null;

  const { data, error } = await supabase.rpc("atencion_metricas", {
    p_company_id: companyId,
    p_desde: desde,
    p_hasta: hasta,
    p_sucursal_id: sucursal,
    p_solo_mias: false,
  });
  const metricas = data as unknown as Metricas | null;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title="Reportes" description="Turnos, tiempos de espera y de atención de toda la sucursal y de cada agente." />
      <FiltrosMetricas ruta="/reportes" periodo={periodo} sucursal={sucursal} sucursales={sucursales} />
      {error || !metricas ? (
        <Alert tone="error" title="No se pudieron cargar los reportes">
          {error
            ? mensajeAtencion(error, "atencion_metricas (reportes)", "Intenta de nuevo en unos minutos.")
            : "Intenta de nuevo en unos minutos."}
        </Alert>
      ) : (
        <>
          <ResumenKpis resumen={metricas.resumen} global />
          <TablaAgentes filas={metricas.por_agente ?? []} />
          <div className="grid gap-6 lg:grid-cols-2">
            <GraficoPorHora
              titulo="Llegada de clientes por hora"
              descripcion="Hora en que recepción entregó cada turno."
              datos={metricas.por_hora}
              unidad="turnos"
            />
            <TablaPuestos filas={metricas.por_puesto ?? []} />
          </div>
          {periodo !== "hoy" && <TablaDias filas={metricas.por_dia} />}
        </>
      )}
    </div>
  );
}
