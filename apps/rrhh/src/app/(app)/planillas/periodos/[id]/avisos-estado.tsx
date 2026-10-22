/**
 * Avisos según el estado de la planilla (B4), debajo del encabezado: qué
 * sigue en un borrador, solo lectura en aprobada (se corrige anulándola) o
 * pagada (ya no se anula: SOLO_LECTURA_PAGADA), motivo de la anulación y su
 * reemplazo, y la regla del aguinaldo. Server Component.
 */
import Link from "next/link";
import { Alert, ButtonLink, fechaCorta, fechaHora } from "@nexo/ui";
import type { PermisosRrhh } from "@/lib/permisos-rrhh";
import { AGUINALDO_SIN_DEDUCCIONES, SOLO_LECTURA, SOLO_LECTURA_PAGADA } from "@/lib/planilla/estados";
import { METODO_PAGO, etiqueta } from "@/lib/planilla/etiquetas";
import { RUTA } from "@/lib/planilla/rutas";
import type { PlanillaDetalle } from "@/lib/planilla/tipos";

const ENLACE =
  "rounded-sm font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function AvisosEstadoPlanilla({
  planilla,
  permisos,
}: {
  planilla: PlanillaDetalle["planilla"];
  permisos: Pick<PermisosRrhh, "novedadesVer" | "planillaGenerar">;
}) {
  const p = planilla;
  return (
    <div className="flex flex-col gap-3">
      {p.estado === "borrador" ? (
        <Alert
          tone="info"
          action={
            permisos.novedadesVer ? (
              <ButtonLink
                href={RUTA.novedades({ desde: p.periodo_inicio, hasta: p.periodo_fin })}
                size="sm"
                variant="secondary"
              >
                Ver novedades del período
              </ButtonLink>
            ) : null
          }
        >
          La planilla está en borrador. Registra las novedades del período y calcúlala.
        </Alert>
      ) : null}

      {p.estado === "calculada" && p.cambios_sin_calcular ? (
        <Alert tone="warning" title="Hubo cambios después del cálculo">
          Cambiaron novedades, contratos o parámetros que usa esta planilla. Vuelve a calcularla antes de aprobarla.
        </Alert>
      ) : null}

      {p.estado === "aprobada" || p.estado === "pagada" ? (
        <Alert tone="info" title="Planilla en solo lectura">
          {p.estado === "aprobada" ? (
            <p>
              Aprobada el {fechaHora(p.aprobada_en)}. {SOLO_LECTURA}
            </p>
          ) : (
            <p>
              Aprobada el {fechaHora(p.aprobada_en)}. Pagada el {fechaCorta(p.fecha_pago ?? p.pagada_en)}
              {p.metodo_pago ? ` con ${etiqueta(METODO_PAGO, p.metodo_pago).toLowerCase()}` : ""}
              {p.referencia_pago ? ` (ref. ${p.referencia_pago})` : ""}. {SOLO_LECTURA_PAGADA}
            </p>
          )}
          {p.hash_aprobado ? (
            <p className="mt-1 text-xs">
              Huella: <span className="tabular-nums">{p.hash_aprobado.slice(0, 12)}</span>
            </p>
          ) : null}
        </Alert>
      ) : null}

      {p.estado === "anulada" ? (
        <Alert
          tone="warning"
          title="Planilla anulada"
          action={
            p.reemplazada_por ? (
              <ButtonLink href={RUTA.detalle(p.reemplazada_por)} size="sm" variant="secondary">
                Ver planilla de reemplazo
              </ButtonLink>
            ) : permisos.planillaGenerar ? (
              <ButtonLink href={RUTA.nuevaPlanilla({ reemplaza: p.id })} size="sm" variant="secondary">
                Generar planilla de reemplazo
              </ButtonLink>
            ) : null
          }
        >
          Anulada el {fechaHora(p.anulada_en)}.{p.motivo_anulacion ? ` Motivo: ${p.motivo_anulacion}` : ""}
        </Alert>
      ) : null}

      {p.reemplaza_a ? (
        <Alert tone="info">
          Esta planilla reemplaza a una anulada del mismo período.{" "}
          <Link href={RUTA.detalle(p.reemplaza_a)} className={ENLACE}>
            Ver la planilla anulada
          </Link>
        </Alert>
      ) : null}

      {p.clase === "aguinaldo" ? <Alert tone="info">{AGUINALDO_SIN_DEDUCCIONES}</Alert> : null}
    </div>
  );
}
