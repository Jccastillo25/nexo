/**
 * Piezas de presentación compartidas por las pantallas de Nómina (Resumen,
 * lista, detalle, comparar, asistencia, novedades). Sin "use client" ni
 * estado: sirven en Server Components y dentro de componentes cliente.
 */
import { EmptyState, PageHeader, StatusBadge } from "@nexo/ui";
import { ESTADO_PLANILLA, estadoVisual } from "@/lib/planilla/estados";
import { etiquetaPeriodo, rangoFechas } from "@/lib/planilla/periodos";
import type { ClasePlanilla, EstadoPlanilla, Frecuencia } from "@/lib/planilla/tipos";

/** Encabezado + acceso denegado (sin llamar a ninguna RPC). */
export function SinAccesoPlanilla({
  titulo,
  pantalla,
  permiso,
}: {
  /** Título de la pantalla (h1). */
  titulo: string;
  /** "a las planillas", "a las novedades"… (completa "No tienes acceso …"). */
  pantalla: string;
  /** Etiqueta del permiso en el catálogo ("Ver planillas"). */
  permiso: string;
}) {
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title={titulo} />
      <EmptyState
        variant="no-access"
        title={`No tienes acceso ${pantalla}`}
        description={`Pide el permiso «${permiso}» a quien administra Nexo.`}
      />
    </div>
  );
}

/** Encabezado + error de carga (sin datos técnicos; el detalle está en el log). */
export function ErrorDeCarga({ titulo, que }: { titulo: string; que: string }) {
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader title={titulo} />
      <EmptyState variant="error" title={`No se pudo cargar ${que}`} />
    </div>
  );
}

/** Insignia del estado de una planilla (siempre con texto). */
export function EstadoPlanillaBadge({ estado }: { estado: EstadoPlanilla | string | null | undefined }) {
  const v = estadoVisual(ESTADO_PLANILLA, estado);
  return <StatusBadge label={v.label} tone={v.tone} />;
}

/** Celda "Período": nombre del período y, debajo, las fechas en gris. */
export function CeldaPeriodo({
  inicio,
  fin,
  frecuencia,
  clase,
}: {
  inicio: string;
  fin: string;
  frecuencia: Frecuencia | null;
  clase: ClasePlanilla | null;
}) {
  return (
    <span className="flex flex-col">
      <span>{etiquetaPeriodo(inicio, fin, frecuencia, clase)}</span>
      <span className="text-xs font-normal text-neutral-500 tabular-nums">{rangoFechas(inicio, fin)}</span>
    </span>
  );
}
