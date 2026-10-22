"use client";

import { useRef, useState, useTransition } from "react";
import { Button, RowActionsMenu, moneda, useToast } from "@nexo/ui";
import { MotivoDialog } from "@/components/planilla/motivo-dialog";
import type { EstadoPrestamo, TipoPrestamo } from "@/lib/planilla/tipos";
import { AlertaError } from "../liquidaciones/_compartido/alerta-error";
import { enfocarDespues } from "../liquidaciones/_compartido/foco";
import { anularPrestamo, cancelarPrestamo } from "./actions";

export interface PrestamoAccionable {
  id: string;
  persona: string;
  tipo: TipoPrestamo;
  estado: EstadoPrestamo;
  /** Saldo pendiente que devuelve planilla_prestamos_saldos. */
  pendiente: number;
}

type Dialogo = "cancelar" | "anular" | null;

/**
 * Acciones de un préstamo vigente (prestamos.gestionar): "Registrar pago
 * fuera de planilla" (con saldo pendiente) y "Anular" (registro por error).
 * En la lista van en el menú "⋯" de la fila; en la ficha, como botones. Un
 * error deja el diálogo abierto con el mensaje de la RPC (un solo canal, con
 * el foco en él); el éxito sale en un toast.
 *
 * Foco al cerrar: al cancelar desde el menú vuelve al botón "⋯" de la fila
 * (el ítem que abrió el diálogo ya no existe); después de una acción
 * correcta va a `focoTrasCambio` (id de un encabezado estable con
 * tabIndex={-1}), porque la fila cambia o sale de la lista y en la ficha los
 * botones desaparecen.
 */
export function AccionesPrestamo({
  prestamo: p,
  modo,
  focoTrasCambio,
}: {
  prestamo: PrestamoAccionable;
  modo: "menu" | "botones";
  focoTrasCambio?: string;
}) {
  const toast = useToast();
  const ancla = useRef<HTMLDivElement>(null);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (p.estado !== "activo") return null;
  const puedeCancelar = p.pendiente > 0;
  const nombre = p.tipo === "adelanto" ? "adelanto" : "préstamo";

  function abrir(d: Dialogo) {
    setError(null);
    setDialogo(d);
  }

  function cerrar() {
    if (pendiente) return;
    setDialogo(null);
    setError(null);
    // Desde el menú, el ítem que abrió el diálogo ya no existe: el foco vuelve al "⋯" de la fila.
    if (modo === "menu") enfocarDespues(() => ancla.current?.querySelector("button"));
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

  return (
    <>
      {modo === "menu" ? (
        <div ref={ancla} className="inline-flex">
          <RowActionsMenu
            actions={[
              ...(puedeCancelar ? [{ label: "Registrar pago fuera de planilla", onClick: () => abrir("cancelar") }] : []),
              { label: `Anular ${nombre}`, onClick: () => abrir("anular"), destructive: true },
            ]}
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {puedeCancelar ? (
            <Button variant="secondary" onClick={() => abrir("cancelar")}>
              Registrar pago fuera de planilla
            </Button>
          ) : null}
          <Button variant="destructive-outline" onClick={() => abrir("anular")}>
            Anular {nombre}
          </Button>
        </div>
      )}

      <MotivoDialog
        open={dialogo === "cancelar"}
        title="Registrar pago fuera de planilla"
        description={`El saldo pendiente de ${moneda(p.pendiente)} de ${p.persona} se pagó fuera de la planilla. Las cuotas pendientes se anulan y el ${nombre} queda cancelado.`}
        confirmLabel="Registrar pago"
        pending={pendiente}
        onConfirm={(motivo) => ejecutar(() => cancelarPrestamo(p.id, motivo), "Pago fuera de planilla registrado.")}
        onCancel={cerrar}
      >
        {alertaError}
      </MotivoDialog>

      <MotivoDialog
        open={dialogo === "anular"}
        title={`Anular ${nombre}`}
        description={`Úsalo si el ${nombre} se registró por error. Solo se puede anular si ninguna cuota entró en una planilla aprobada.`}
        confirmLabel={`Anular ${nombre}`}
        destructive
        pending={pendiente}
        onConfirm={(motivo) => ejecutar(() => anularPrestamo(p.id, motivo), p.tipo === "adelanto" ? "Adelanto anulado." : "Préstamo anulado.")}
        onCancel={cerrar}
      >
        {alertaError}
      </MotivoDialog>
    </>
  );
}
