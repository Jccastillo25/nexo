"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, NexoIcon, fechaHora, useToast } from "@nexo/ui";
import { etiquetaMes } from "@/lib/planilla/periodos";
import { AlertaError } from "../configuracion/_compartido/alerta-error";
import { generarProvisiones } from "./actions";

const TITULO_ERROR = "No se pudieron generar las provisiones";

/**
 * Botón "Generar provisiones de {mes}" (planilla.generar; la acción y la RPC
 * vuelven a validarlo). Si el mes ya tiene copia, pide confirmar antes de
 * reemplazarla con los valores de hoy. Un mes futuro no se genera. Un solo
 * canal de error, con el foco en él: dentro del diálogo si está abierto (y
 * sigue abierto), si no, debajo del botón. El éxito sale en un toast.
 */
export function GenerarProvisiones({
  mes,
  futuro,
  copiaDel,
}: {
  /** "YYYY-MM". */
  mes: string;
  /** El mes es posterior al actual. */
  futuro: boolean;
  /** Cuándo se guardó la copia actual del mes (null si no hay). */
  copiaDel: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const nombre = etiquetaMes(mes);

  function generar() {
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    startTransition(async () => {
      const r = await generarProvisiones(mes);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setConfirmando(false);
      toast.show(`Provisiones de ${nombre} guardadas: ${r.data === 1 ? "1 contrato" : `${r.data} contratos`}.`, "success");
      router.refresh();
    });
  }

  function cancelar() {
    if (pendiente) return;
    setConfirmando(false);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            if (!copiaDel) {
              generar();
              return;
            }
            setError(null);
            setConfirmando(true);
          }}
          loading={pendiente}
          disabled={futuro}
          aria-describedby={futuro ? "provisiones-futuro" : undefined}
          icon={<NexoIcon name="refresh" />}
        >
          Generar provisiones de {nombre}
        </Button>
        {futuro ? (
          <p id="provisiones-futuro" className="text-xs text-neutral-500">
            No se generan provisiones de meses futuros.
          </p>
        ) : null}
      </div>
      {error && !confirmando ? <AlertaError title={TITULO_ERROR}>{error}</AlertaError> : null}
      <ConfirmDialog
        open={confirmando}
        title={`Volver a generar las provisiones de ${nombre}`}
        description={`La copia guardada el ${copiaDel ? fechaHora(copiaDel) : ""} se reemplaza con los valores de hoy. No se duplica.`}
        confirmLabel="Volver a generar"
        pending={pendiente}
        onConfirm={generar}
        onCancel={cancelar}
      >
        {error ? <AlertaError title={TITULO_ERROR}>{error}</AlertaError> : null}
      </ConfirmDialog>
    </div>
  );
}
