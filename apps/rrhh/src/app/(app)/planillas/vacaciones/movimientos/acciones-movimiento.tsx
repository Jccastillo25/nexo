"use client";

import { useId, useState, useTransition } from "react";
import { Button, ConfirmDialog, fechaCorta, useToast } from "@nexo/ui";
import { MotivoDialog } from "@/components/planilla/motivo-dialog";
import { MOTIVO_SEPARACION } from "@/lib/planilla/estados";
import { diasTexto } from "@/lib/planilla/formato";
import type { EstadoVacaciones, TipoVacaciones } from "@/lib/planilla/tipos";
import { AlertaError } from "../../liquidaciones/_compartido/alerta-error";
import { enfocarDespues } from "../../liquidaciones/_compartido/foco";
import { anularVacaciones, aprobarVacaciones, rechazarVacaciones } from "../actions";

export interface MovimientoAccionable {
  id: string;
  persona: string;
  tipo: TipoVacaciones;
  estado: EstadoVacaciones;
  /** Con signo en un ajuste. */
  dias: number;
  /** "YYYY-MM-DD" (fecha de corte en un saldo inicial). */
  fecha: string;
  /** Quien mira registró el movimiento: no lo aprueba (separación de funciones, D5). */
  esAutor: boolean;
}

type Dialogo = "aprobar" | "rechazar" | "anular" | null;

/** Texto del diálogo de aprobación según el tipo (la RPC decide el saldo; aquí solo se explica). */
function descripcionAprobar(m: MovimientoAccionable): string {
  const dias = diasTexto(Math.abs(m.dias));
  if (m.tipo === "saldo_inicial") return `El saldo de ${m.persona} queda en ${dias} al corte del ${fechaCorta(m.fecha)}.`;
  if (m.tipo === "ajuste" && m.dias > 0) return `Se suman ${dias} al saldo de ${m.persona}.`;
  const base = `Se descuentan ${dias} del saldo de ${m.persona}.`;
  return m.tipo === "pago" ? `${base} El pago entra como novedad en la planilla del período.` : base;
}

/**
 * Acciones de una fila de movimientos (C2), solo con vacaciones.aprobar:
 * Aprobar y Rechazar una solicitud; Anular uno aprobado (salvo el de una
 * liquidación, que se anula con la liquidación). Visibles, no en un menú:
 * "Aprobar" se ve deshabilitado con el motivo cuando quien mira registró el
 * movimiento (D5); el servidor también lo rechaza. Un error deja el diálogo
 * abierto con el mensaje de la RPC (un solo canal, con el foco en él); el
 * éxito sale en un toast. Después de una acción correcta los botones de la
 * fila cambian (o la fila sale del filtro), así que el foco va a
 * `focoTrasCambio` (id de un encabezado estable con tabIndex={-1}).
 */
export function AccionesMovimiento({
  movimiento: m,
  focoTrasCambio,
}: {
  movimiento: MovimientoAccionable;
  focoTrasCambio?: string;
}) {
  const toast = useToast();
  const motivoId = useId();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const puedeResolver = m.estado === "solicitada";
  const puedeAnular = m.estado === "aprobada" && m.tipo !== "liquidacion";
  if (!puedeResolver && !puedeAnular) return null;

  function abrir(d: Dialogo) {
    setError(null);
    setDialogo(d);
  }

  function cerrar() {
    if (pendiente) return;
    setDialogo(null);
    setError(null);
  }

  function ejecutar(accion: () => Promise<{ ok: true } | { ok: false; message: string }>, exito: string) {
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDialogo(null);
      setError(null);
      toast.show(exito, "success");
      if (focoTrasCambio) enfocarDespues(() => document.getElementById(focoTrasCambio));
    });
  }

  const alertaError = error ? <AlertaError>{error}</AlertaError> : null;
  const exitoAprobar = m.tipo === "goce" || m.tipo === "pago" ? "Vacaciones aprobadas." : "Movimiento aprobado.";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {puedeResolver ? (
          <>
            <Button
              size="sm"
              disabled={m.esAutor}
              aria-describedby={m.esAutor ? motivoId : undefined}
              onClick={() => abrir("aprobar")}
              aria-label={`Aprobar movimiento de ${m.persona}`}
            >
              Aprobar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => abrir("rechazar")} aria-label={`Rechazar solicitud de ${m.persona}`}>
              Rechazar
            </Button>
          </>
        ) : null}
        {puedeAnular ? (
          <Button
            size="sm"
            variant="destructive-outline"
            onClick={() => abrir("anular")}
            aria-label={`Anular movimiento de ${m.persona}`}
          >
            Anular
          </Button>
        ) : null}
      </div>
      {puedeResolver && m.esAutor ? (
        <p id={motivoId} className="max-w-48 text-right text-xs text-neutral-500">
          {MOTIVO_SEPARACION}
        </p>
      ) : null}

      <ConfirmDialog
        open={dialogo === "aprobar"}
        title="Aprobar vacaciones"
        description={descripcionAprobar(m)}
        confirmLabel="Aprobar"
        pending={pendiente}
        onConfirm={() => ejecutar(() => aprobarVacaciones(m.id), exitoAprobar)}
        onCancel={cerrar}
      >
        {alertaError}
      </ConfirmDialog>

      <MotivoDialog
        open={dialogo === "rechazar"}
        title="Rechazar solicitud"
        description={`La solicitud de ${m.persona} no cuenta en el saldo. El motivo queda registrado.`}
        confirmLabel="Rechazar solicitud"
        pending={pendiente}
        onConfirm={(motivo) => ejecutar(() => rechazarVacaciones(m.id, motivo), "Solicitud rechazada.")}
        onCancel={cerrar}
      >
        {alertaError}
      </MotivoDialog>

      <MotivoDialog
        open={dialogo === "anular"}
        title="Anular movimiento"
        description="El movimiento deja de contar en el saldo. Queda registrado quién lo anuló y por qué."
        confirmLabel="Anular movimiento"
        destructive
        pending={pendiente}
        onConfirm={(motivo) => ejecutar(() => anularVacaciones(m.id, motivo), "Movimiento anulado.")}
        onCancel={cerrar}
      >
        {alertaError}
      </MotivoDialog>
    </div>
  );
}
