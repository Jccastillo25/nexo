/**
 * Encabezado común de las pestañas de una planilla (Personas, Comparar con la
 * anterior, Importar de Asistencia): título con el período, tipo y fechas,
 * estado, regreso a la lista y pestañas. Server Component.
 */
import type { ReactNode } from "react";
import { PageHeader, TabLinks, fechaCorta } from "@nexo/ui";
import type { PermisosRrhh } from "@/lib/permisos-rrhh";
import { delAl, etiquetaPeriodo } from "@/lib/planilla/periodos";
import { RUTA } from "@/lib/planilla/rutas";
import type { PlanillaDetalle } from "@/lib/planilla/tipos";
import { EstadoPlanillaBadge } from "../compartido";

export type PestanaPlanilla = "personas" | "comparar" | "asistencia";

type PlanillaEncabezado = PlanillaDetalle["planilla"];

export function tituloPlanilla(p: PlanillaEncabezado): string {
  return etiquetaPeriodo(p.periodo_inicio, p.periodo_fin, p.frecuencia, p.clase);
}

type PermisosEncabezado = Pick<PermisosRrhh, "novedadesCrear" | "asistenciaReportesVer">;

/**
 * ¿Se puede importar de Asistencia? Borrador o calculada, clase ordinaria,
 * permiso de crear novedades y de leer los reportes de asistencia (la RPC
 * lee marcas: sin él la pestaña no se muestra).
 */
export function puedeImportarAsistencia(p: PlanillaEncabezado, permisos: PermisosEncabezado): boolean {
  return (
    permisos.novedadesCrear &&
    permisos.asistenciaReportesVer &&
    (p.estado === "borrador" || p.estado === "calculada") &&
    p.clase === "ordinaria"
  );
}

export function EncabezadoPlanilla({
  planilla,
  activa,
  permisos,
  actions,
}: {
  planilla: PlanillaEncabezado;
  activa: PestanaPlanilla;
  permisos: PermisosEncabezado;
  actions?: ReactNode;
}) {
  const pestanas = [
    { label: "Personas", href: RUTA.detalle(planilla.id), active: activa === "personas" },
    ...(planilla.estado !== "borrador"
      ? [{ label: "Comparar con la anterior", href: RUTA.comparar(planilla.id), active: activa === "comparar" }]
      : []),
    // En la propia pestaña se sigue mostrando (activa) aunque falte el permiso: la página explica qué falta.
    ...(puedeImportarAsistencia(planilla, permisos) || activa === "asistencia"
      ? [{ label: "Importar de Asistencia", href: RUTA.importarAsistencia(planilla.id), active: activa === "asistencia" }]
      : []),
  ];

  const descripcion = [
    planilla.tipo_nombre,
    delAl(planilla.periodo_inicio, planilla.periodo_fin),
    planilla.fecha_pago ? `Pago: ${fechaCorta(planilla.fecha_pago)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageHeader
      title={tituloPlanilla(planilla)}
      description={descripcion}
      meta={<EstadoPlanillaBadge estado={planilla.estado} />}
      back={{ href: RUTA.periodos(), label: "Planillas" }}
      actions={actions}
      tabs={pestanas.length > 1 ? <TabLinks items={pestanas} label="Secciones de la planilla" /> : null}
    />
  );
}
