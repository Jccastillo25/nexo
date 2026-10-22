import type { ReactNode } from "react";
import { Alert, ButtonLink, EmptyState, PageHeader } from "@nexo/ui";
import type { AyudaError } from "@/lib/planilla/rutas";
import type { Resultado } from "@/lib/planilla/tipos";

/**
 * Estados de carga compartidos por las pantallas del paquete A de Planilla
 * (configuración, simulador de régimen, pasivo y declaraciones). Sin
 * "use client": se usan desde Server Components.
 *
 * Regla (especificación §4.1): "sin datos" es distinto de "falló".
 * - denegado (42501 o sin permiso): EmptyState no-access, sin código de permiso.
 * - negocio (P0001, texto escrito por la RPC): Alert warning con ese texto.
 * - error (cualquier otro): EmptyState error genérico; el detalle ya quedó en
 *   el log del servidor (mensajeDeError).
 *
 * Carpeta privada (`_compartido`): Next no la convierte en ruta. Candidato a
 * generalizarse en components/planilla (pedido al coordinador).
 */

export type FalloCarga = Extract<Resultado<unknown>, { ok: false }>;

export interface AccesoPantalla {
  /** Título de la página (el h1 de PageHeader). */
  titulo: string;
  /** Lo que no se puede ver: "No tienes acceso a {pantalla}". */
  pantalla: string;
  /** Nombre del permiso en el catálogo, para pedirlo. */
  permiso: string;
}

/** EmptyState de acceso denegado (sin el h1). */
export function SinAcceso({ pantalla, permiso }: Omit<AccesoPantalla, "titulo">) {
  return (
    <EmptyState
      variant="no-access"
      title={`No tienes acceso a ${pantalla}`}
      description={`Pide el permiso «${permiso}» a quien administra Nexo.`}
    />
  );
}

/** Página completa de acceso denegado: encabezado + EmptyState. No consulta nada. */
export function PaginaSinAcceso({ titulo, pantalla, permiso }: AccesoPantalla) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={titulo} />
      <SinAcceso pantalla={pantalla} permiso={permiso} />
    </div>
  );
}

/** Enlaces de ayuda de `ayudaDeError` (solo los que el rol puede abrir). */
function EnlacesAyuda({ ayuda }: { ayuda?: readonly AyudaError[] }) {
  if (!ayuda || ayuda.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {ayuda.map((a) => (
        <ButtonLink key={a.href} href={a.href} variant="secondary" size="sm">
          {a.label}
        </ButtonLink>
      ))}
    </div>
  );
}

/**
 * Bloque para una lectura fallida: no-access, aviso del negocio o error.
 * `que` completa "No se pudo cargar {que}".
 */
export function BloqueFallo({
  fallo,
  que,
  acceso,
  ayuda,
  titulo,
}: {
  fallo: FalloCarga;
  que: string;
  acceso: Omit<AccesoPantalla, "titulo">;
  ayuda?: readonly AyudaError[];
  /** Título del aviso del negocio (por defecto "No se pudo cargar {que}"). */
  titulo?: string;
}) {
  if (fallo.motivo === "denegado") return <SinAcceso pantalla={acceso.pantalla} permiso={acceso.permiso} />;
  if (fallo.motivo === "negocio") {
    return (
      <Alert tone="warning" title={titulo ?? `No se pudo cargar ${que}`}>
        <p>{fallo.mensaje}</p>
        <EnlacesAyuda ayuda={ayuda} />
      </Alert>
    );
  }
  return <EmptyState variant="error" title={`No se pudo cargar ${que}`} />;
}

/** Página completa cuando falla la fuente principal: encabezado + BloqueFallo. */
export function PaginaFallo({
  acceso,
  fallo,
  que,
  descripcion,
  ayuda,
  back,
}: {
  acceso: AccesoPantalla;
  fallo: FalloCarga;
  que: string;
  descripcion?: ReactNode;
  ayuda?: readonly AyudaError[];
  back?: { href: string; label?: string };
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={acceso.titulo} description={descripcion} back={back} />
      <BloqueFallo fallo={fallo} que={que} acceso={acceso} ayuda={ayuda} />
    </div>
  );
}
