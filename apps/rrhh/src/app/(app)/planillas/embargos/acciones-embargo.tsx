"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, fechaCorta, useToast } from "@nexo/ui";
import { MotivoDialog } from "@/components/planilla/motivo-dialog";
import { sumarDias } from "@/lib/fecha-managua";
import { esFechaIso } from "@/lib/planilla/periodos";
import { AlertaError } from "../liquidaciones/_compartido/alerta-error";
import { enfocarDespues } from "../liquidaciones/_compartido/foco";
import { terminarEmbargo } from "./actions";

export interface EmbargoAccionable {
  id: string;
  persona: string;
  /** "YYYY-MM-DD". */
  vigenteDesde: string;
}

/**
 * "Terminar" de un embargo vigente (prestamos.gestionar). Pide la fecha de
 * fin y el motivo. Con el día anterior al inicio la RPC lo anula (registro por
 * error, sin cobros aprobados); si ya se cobró en planillas aprobadas, la RPC
 * no deja terminarlo antes de la última. Un error queda solo en el diálogo,
 * que sigue abierto, y recibe el foco; el éxito sale en un toast. Después de
 * terminar, el botón de la fila puede desaparecer: el foco va a
 * `focoTrasCambio` (id de un encabezado estable con tabIndex={-1}).
 */
export function AccionesEmbargo({
  embargo: e,
  hoy,
  focoTrasCambio,
}: {
  embargo: EmbargoAccionable;
  hoy: string;
  focoTrasCambio?: string;
}) {
  const toast = useToast();
  const minimo = sumarDias(e.vigenteDesde, -1);
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoy >= e.vigenteDesde ? hoy : e.vigenteDesde);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function abrir() {
    setFecha(hoy >= e.vigenteDesde ? hoy : e.vigenteDesde);
    setErrorFecha(null);
    setError(null);
    setAbierto(true);
  }

  function cerrar() {
    if (pendiente) return;
    setAbierto(false);
  }

  function confirmar(motivo: string) {
    if (!esFechaIso(fecha)) {
      setErrorFecha("Indica la fecha de fin.");
      return;
    }
    if (fecha < minimo) {
      setErrorFecha(`La fecha no puede ser anterior al ${fechaCorta(minimo)}.`);
      return;
    }
    setErrorFecha(null);
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    const anula = fecha < e.vigenteDesde;
    startTransition(async () => {
      const r = await terminarEmbargo(e.id, fecha, motivo);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setAbierto(false);
      toast.show(anula ? "Embargo anulado." : "Embargo terminado.", "success");
      if (focoTrasCambio) enfocarDespues(() => document.getElementById(focoTrasCambio));
    });
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={abrir} aria-label={`Terminar embargo de ${e.persona}`}>
        Terminar
      </Button>
      <MotivoDialog
        open={abierto}
        title="Terminar embargo"
        description="El embargo deja de descontarse después de esa fecha."
        confirmLabel="Terminar embargo"
        pending={pendiente}
        onConfirm={confirmar}
        onCancel={cerrar}
      >
        {error ? <AlertaError>{error}</AlertaError> : null}
        <Field
          label="Fecha de fin"
          required
          error={errorFecha ?? undefined}
          hint={`Si eliges el ${fechaCorta(minimo)} (el día antes del inicio), el embargo queda anulado: úsalo solo si se registró por error.`}
        >
          <Input
            type="date"
            required
            min={minimo}
            value={fecha}
            disabled={pendiente}
            onChange={(ev) => {
              setFecha(ev.target.value);
              if (errorFecha) setErrorFecha(null);
            }}
          />
        </Field>
      </MotivoDialog>
    </>
  );
}
