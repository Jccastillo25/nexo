import { Alert, EmptyState } from "@nexo/ui";
import type { Resultado } from "@/lib/planilla/tipos";

/**
 * Estados de lectura del Paquete C (Prestaciones): vacaciones, préstamos,
 * embargos y liquidaciones. Carpeta privada (`_compartido`, no es ruta).
 * Sin "use client": sirve en Server Components.
 *
 * Candidato a moverse a `components/planilla/` (lo usan los tres paquetes
 * con el mismo texto de la especificación §4.1).
 */

export interface SinAccesoInfo {
  /** Nombre de la pantalla: "Vacaciones", "Préstamos y adelantos"… */
  pantalla: string;
  /** Etiqueta del permiso en el catálogo: "Ver vacaciones". */
  permiso: string;
}

/** Sin el permiso de ver: nunca el código del permiso, solo su nombre. */
export function SinAcceso({ pantalla, permiso }: SinAccesoInfo) {
  return (
    <EmptyState
      variant="no-access"
      title={`No tienes acceso a ${pantalla}`}
      description={`Pide el permiso «${permiso}» a quien administra Nexo.`}
    />
  );
}

/**
 * Fallo de una lectura (`Resultado` de consultarRpc), distinto de "sin datos":
 * - denegado (42501, cambió el rol): el mismo EmptyState de acceso denegado;
 * - negocio (P0001, texto escrito por la RPC): Alert warning con ese texto;
 * - error: EmptyState error sin detalle técnico (el detalle ya quedó en el log).
 */
export function FalloLectura({
  fallo,
  titulo,
  acceso,
}: {
  fallo: Extract<Resultado<unknown>, { ok: false }>;
  /** "No se pudieron cargar los saldos de vacaciones". */
  titulo: string;
  acceso: SinAccesoInfo;
}) {
  if (fallo.motivo === "denegado") return <SinAcceso {...acceso} />;
  if (fallo.motivo === "negocio") return <Alert tone="warning">{fallo.mensaje}</Alert>;
  return <EmptyState variant="error" title={titulo} />;
}
