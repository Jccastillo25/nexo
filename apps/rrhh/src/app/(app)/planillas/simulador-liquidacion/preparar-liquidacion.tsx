"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, Field, Textarea, fechaCorta, useToast } from "@nexo/ui";
import { RUTA } from "@/lib/planilla/rutas";
import type { CausaLiquidacion } from "@/lib/planilla/tipos";
import { AlertaError } from "../liquidaciones/_compartido/alerta-error";
import { crearLiquidacion } from "../liquidaciones/actions";

const NOTA_MAX = 500;
const MOTIVO_VACACIONES =
  "La liquidación usa el saldo registrado de vacaciones. Deja vacío el campo o registra un ajuste en Vacaciones.";

/**
 * "Preparar liquidación" (C7), con liquidaciones.calcular: guarda la
 * liquidación en estado Calculada con planilla_liquidacion_crear (que vuelve
 * a calcular con el saldo de vacaciones registrado y descuenta los préstamos
 * pendientes). Solo después de una simulación correcta, con el campo de
 * vacaciones vacío y, si el contrato ya terminó, con su fecha de fin como
 * fecha de egreso (la RPC lo exige); si no, el botón se ve deshabilitado con
 * el motivo. Un error queda solo en el diálogo, que sigue abierto, y recibe
 * el foco; el éxito sale en un toast.
 */
export function PrepararLiquidacion({
  simulacion,
  vacacionesManual,
  finContrato,
  puedeVerLiquidaciones,
}: {
  simulacion: {
    contratoId: string;
    egreso: string;
    causa: CausaLiquidacion;
    pendiente: number;
    confianza: number | null;
  };
  /** Se simuló con días de vacaciones escritos a mano: no se puede preparar con ellos. */
  vacacionesManual: boolean;
  /** Fecha de fin real del contrato si ya está finalizado ("YYYY-MM-DD"); null si sigue activo. */
  finContrato: string | null;
  puedeVerLiquidaciones: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const motivoId = useId();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const motivos = [
    vacacionesManual ? MOTIVO_VACACIONES : null,
    finContrato && simulacion.egreso !== finContrato
      ? `El contrato terminó el ${fechaCorta(finContrato)}: usa esa fecha de egreso.`
      : null,
  ].filter((m): m is string => m !== null);
  const bloqueado = motivos.length > 0;

  function abrir() {
    setNota("");
    setError(null);
    setAbierto(true);
  }

  function confirmar() {
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    if (nota.trim().length > NOTA_MAX) {
      setError(`La nota admite hasta ${NOTA_MAX} caracteres.`);
      return;
    }
    startTransition(async () => {
      const r = await crearLiquidacion({
        contratoId: simulacion.contratoId,
        fechaEgreso: simulacion.egreso,
        causa: simulacion.causa,
        diasSalarioPendiente: simulacion.pendiente,
        mesesConfianza: simulacion.confianza,
        nota: nota.trim() || null,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setAbierto(false);
      toast.show("Liquidación preparada. Falta que otra persona la apruebe.", "success");
      router.push(puedeVerLiquidaciones ? RUTA.liquidacion(r.data) : RUTA.simuladorLiquidacion());
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={abrir} disabled={bloqueado} aria-describedby={bloqueado ? motivoId : undefined}>
        Preparar liquidación
      </Button>
      {bloqueado ? (
        <p id={motivoId} className="text-sm text-neutral-600">
          {motivos.join(" ")}
        </p>
      ) : null}

      <ConfirmDialog
        open={abierto}
        title="Preparar liquidación"
        description="Se guarda en estado Calculada con el saldo de vacaciones registrado y descontando los préstamos pendientes. No cambia el contrato. La aprueba otra persona."
        confirmLabel="Preparar liquidación"
        pending={pendiente}
        onConfirm={confirmar}
        onCancel={() => {
          if (!pendiente) setAbierto(false);
        }}
      >
        <div className="flex flex-col gap-3">
          {error ? <AlertaError>{error}</AlertaError> : null}
          <Field label="Nota" optional hint={`${nota.length}/${NOTA_MAX}`}>
            <Textarea rows={3} maxLength={NOTA_MAX} value={nota} disabled={pendiente} onChange={(e) => setNota(e.target.value)} />
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}
