"use server";

import { revalidatePath } from "next/cache";
import { P } from "@/lib/permisos-rrhh";
import { accionRpc, prepararAccion, type ActionResult } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { validarMotivo } from "@/lib/planilla/estados";
import type { OrigenPrestamo, TipoPrestamo } from "@/lib/planilla/tipos";

/**
 * Server Actions de Préstamos y adelantos (C4), con prestamos.gestionar.
 * prepararAccion (requirePermission ANTES de todo) → validación de formato →
 * RPC con `companyId` del servidor. El plan de cuotas, la fecha de cada cuota
 * y las reglas (período pasado, planilla aprobada, cuotas cobradas) son de
 * las RPC `planilla_prestamo_*`: aquí no se calcula ninguna cuota.
 */

export interface CrearPrestamoInput {
  contratoId: string;
  tipo: TipoPrestamo;
  monto: number;
  cuotas: number;
  /** "YYYY-MM-DD": se descuenta en la planilla cuyo período incluye esta fecha. */
  fechaPrimera: string;
  /** "ag" = saldo vigente traído de AG Planilla (carga inicial). */
  origen: OrigenPrestamo;
  nota: string | null;
}

const NOTA_MAX = 300;
const REVISA = "Revisa los datos e intenta de nuevo.";

function revalidarPrestamos(id?: string) {
  revalidatePath(RUTA.prestamos());
  if (id) revalidatePath(RUTA.prestamo(id));
  // Las cuotas son novedades de origen "préstamo".
  revalidatePath(RUTA.novedades());
}

export async function crearPrestamo(input: CrearPrestamoInput): Promise<ActionResult<string>> {
  const prep = await prepararAccion(P.prestamosGestionar, "crearPrestamo");
  if (!prep.ok) return prep;

  if (!esUuid(input?.contratoId)) return { ok: false, message: "Elige la persona." };
  if (input.tipo !== "prestamo" && input.tipo !== "adelanto") return { ok: false, message: "Indica si es préstamo o adelanto." };
  if (input.origen !== "nexo" && input.origen !== "ag") return { ok: false, message: REVISA };
  const monto = input.monto;
  if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0 || monto >= 100_000_000 || Math.abs(Math.round(monto * 100) - monto * 100) > 1e-6) {
    return { ok: false, message: "Indica un monto válido, mayor que 0 y con hasta dos decimales." };
  }
  if (!Number.isInteger(input.cuotas) || input.cuotas < 1 || input.cuotas > 120) {
    return { ok: false, message: "Indica entre 1 y 120 cuotas." };
  }
  if (!esFechaIso(input.fechaPrimera)) return { ok: false, message: "Indica la fecha de la primera cuota." };
  const nota = typeof input.nota === "string" ? input.nota.trim() : "";
  if (nota.length > NOTA_MAX) return { ok: false, message: `La nota admite hasta ${NOTA_MAX} caracteres.` };

  const r = await accionRpc<string>(
    prep.ctx,
    "planilla_prestamo_crear",
    {
      p_contrato_id: input.contratoId,
      p_tipo: input.tipo,
      p_monto: monto,
      p_cuotas: input.cuotas,
      p_fecha_primera: input.fechaPrimera,
      p_nota: nota || null,
      p_origen: input.origen,
    },
    "crearPrestamo",
    "No se pudo registrar el préstamo. Intenta de nuevo."
  );
  if (r.ok) revalidarPrestamos();
  return r;
}

/** Pagado fuera de planilla: anula las cuotas pendientes y deja el préstamo cancelado. */
export async function cancelarPrestamo(prestamoId: string, motivo: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.prestamosGestionar, "cancelarPrestamo");
  if (!prep.ok) return prep;
  if (!esUuid(prestamoId)) return { ok: false, message: REVISA };
  const problema = validarMotivo(motivo);
  if (problema) return { ok: false, message: problema };

  const r = await accionRpc(
    prep.ctx,
    "planilla_prestamo_cancelar",
    { p_prestamo_id: prestamoId, p_motivo: motivo.trim() },
    "cancelarPrestamo",
    "No se pudo registrar el pago fuera de planilla. Intenta de nuevo."
  );
  if (r.ok) revalidarPrestamos(prestamoId);
  return r;
}

/** Registro por error: solo si ninguna cuota entró en una planilla aprobada (lo valida la RPC). */
export async function anularPrestamo(prestamoId: string, motivo: string): Promise<ActionResult> {
  const prep = await prepararAccion(P.prestamosGestionar, "anularPrestamo");
  if (!prep.ok) return prep;
  if (!esUuid(prestamoId)) return { ok: false, message: REVISA };
  const problema = validarMotivo(motivo);
  if (problema) return { ok: false, message: problema };

  const r = await accionRpc(
    prep.ctx,
    "planilla_prestamo_anular",
    { p_prestamo_id: prestamoId, p_motivo: motivo.trim() },
    "anularPrestamo",
    "No se pudo anular el préstamo. Intenta de nuevo."
  );
  if (r.ok) revalidarPrestamos(prestamoId);
  return r;
}
