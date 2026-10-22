"use client";

import { useId, useState, useTransition } from "react";
import { Alert, Button, ButtonLink, ConfirmDialog, NexoIcon, fechaCorta, moneda, useToast } from "@nexo/ui";
import { MotivoDialog } from "@/components/planilla/motivo-dialog";
import { PagoDialog, type DatosPago } from "@/components/planilla/pago-dialog";
import { sumarDias } from "@/lib/fecha-managua";
import { RUTA } from "@/lib/planilla/rutas";
import { AVISO_CONTADOR, AYUDA_APROBAR_LIQUIDACION, MOTIVO_FALTA_FINALIZAR, MOTIVO_SEPARACION } from "@/lib/planilla/estados";
import type { EstadoLiquidacion } from "@/lib/planilla/tipos";
import { AlertaError } from "../_compartido/alerta-error";
import { anularLiquidacion, aprobarLiquidacion, pagarLiquidacion, recalcularLiquidacion } from "../actions";

export interface LiquidacionAccionable {
  id: string;
  estado: EstadoLiquidacion;
  persona: string;
  /** "YYYY-MM-DD". */
  fechaEgreso: string;
  neto: number;
  /** Hay avisos de valores que confirma el contador. */
  avisosContador: boolean;
  /**
   * El contrato sigue activo (`contrato_estado`): aprobar lo finaliza, así que
   * exige el permiso de finalizar contratos y que la fecha de egreso ya haya
   * llegado. Con el contrato ya finalizado no aplica ninguna de las dos.
   */
  contratoActivo: boolean;
}

export interface PermisosLiquidacion {
  recalcular: boolean;
  aprobar: boolean;
  pagar: boolean;
  anular: boolean;
  imprimir: boolean;
  /** rrhh.expedientes.contratos.finalizar: aprobar finaliza el contrato (D3). */
  finalizarContratos: boolean;
}

type Dialogo = "aprobar" | "pagar" | "anular" | null;

/**
 * Barra de acciones del documento de liquidación (C8). Cada botón se oculta
 * sin su permiso. "Aprobar liquidación" se ve DESHABILITADO, con el motivo en
 * texto, si quien mira la creó o la calculó (separación de funciones) o, con
 * el contrato todavía activo, si la fecha de egreso no ha llegado o no puede
 * finalizar contratos (D3); el servidor también lo rechaza. Aprobada o
 * pagada: solo pagar (si está aprobada), imprimir y anular (si está
 * aprobada). Errores, en un solo lugar y con el foco en él: el de "Volver a
 * calcular", en un Alert arriba de los botones; el de un diálogo, dentro del
 * diálogo. El éxito sale en un toast.
 */
export function AccionesLiquidacion({
  liquidacion: l,
  permisos: p,
  esAutor,
  hoy,
}: {
  liquidacion: LiquidacionAccionable;
  permisos: PermisosLiquidacion;
  esAutor: boolean;
  hoy: string;
}) {
  const toast = useToast();
  const motivoId = useId();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorBarra, setErrorBarra] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [recalculando, startRecalculo] = useTransition();

  const calculada = l.estado === "calculada";
  const aprobada = l.estado === "aprobada";
  const verRecalcular = calculada && p.recalcular;
  const verAprobar = calculada && p.aprobar;
  const verPagar = aprobada && p.pagar;
  const verImprimir = (aprobada || l.estado === "pagada") && p.imprimir;
  const verAnular = (calculada || aprobada) && p.anular;
  if (!verRecalcular && !verAprobar && !verPagar && !verImprimir && !verAnular) return null;

  // `hoy` es la fecha de Managua que calcula el servidor (como la RPC).
  const egresoPorLlegar = l.contratoActivo && l.fechaEgreso > hoy;
  const motivos = [
    esAutor ? MOTIVO_SEPARACION : null,
    egresoPorLlegar ? `Se puede aprobar desde el ${fechaCorta(l.fechaEgreso)}.` : null,
    l.contratoActivo && !p.finalizarContratos ? MOTIVO_FALTA_FINALIZAR : null,
  ].filter((m): m is string => m !== null);
  const aprobarBloqueado = motivos.length > 0;
  const ocupado = pendiente || recalculando;

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
      setErrorBarra(null);
      toast.show(exito, "success");
    });
  }

  function recalcular() {
    setErrorBarra(null);
    startRecalculo(async () => {
      const r = await recalcularLiquidacion(l.id);
      if (!r.ok) {
        setErrorBarra(r.message);
        return;
      }
      toast.show("Liquidación recalculada.", "success");
    });
  }

  const alertaError = error ? <AlertaError>{error}</AlertaError> : null;
  const avisoContador = l.avisosContador ? <Alert tone="info">{AVISO_CONTADOR}</Alert> : null;

  return (
    <section aria-label="Acciones de la liquidación" className="flex flex-col gap-3">
      {errorBarra ? <AlertaError title="No se pudo volver a calcular la liquidación">{errorBarra}</AlertaError> : null}
      <div className="flex flex-wrap items-center gap-2">
        {verAprobar ? (
          <Button
            disabled={aprobarBloqueado || ocupado}
            aria-describedby={aprobarBloqueado ? motivoId : undefined}
            onClick={() => abrir("aprobar")}
          >
            Aprobar liquidación
          </Button>
        ) : null}
        {verPagar ? (
          <Button disabled={ocupado} onClick={() => abrir("pagar")}>
            Marcar como pagada
          </Button>
        ) : null}
        {verRecalcular ? (
          <Button variant="secondary" loading={recalculando} disabled={pendiente} onClick={recalcular} icon={<NexoIcon name="refresh" />}>
            {recalculando ? "Calculando…" : "Volver a calcular"}
          </Button>
        ) : null}
        {verImprimir ? (
          <ButtonLink href={RUTA.imprimir.liquidacion(l.id)} target="_blank" rel="noopener" variant="secondary" icon={<NexoIcon name="file" />}>
            Imprimir liquidación
          </ButtonLink>
        ) : null}
        {verAnular ? (
          <Button variant="destructive-outline" disabled={ocupado} onClick={() => abrir("anular")}>
            Anular liquidación
          </Button>
        ) : null}
      </div>
      {verAprobar && aprobarBloqueado ? (
        <p id={motivoId} className="text-sm text-neutral-600">
          {motivos.join(" ")}
        </p>
      ) : null}

      <ConfirmDialog
        open={dialogo === "aprobar"}
        title="Aprobar liquidación"
        description="Después de aprobarla, los montos quedan fijos. Para corregirla habrá que anularla y preparar otra."
        confirmLabel="Aprobar liquidación"
        pending={pendiente}
        onConfirm={() => ejecutar(() => aprobarLiquidacion(l.id), "Liquidación aprobada.")}
        onCancel={cerrar}
      >
        <div className="flex flex-col gap-3">
          {alertaError}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-neutral-500">Persona</dt>
            <dd className="font-medium text-neutral-900">{l.persona}</dd>
            <dt className="text-neutral-500">Egreso</dt>
            <dd className="text-neutral-900 tabular-nums">{fechaCorta(l.fechaEgreso)}</dd>
            <dt className="text-neutral-500">Neto a pagar</dt>
            <dd className="font-semibold text-neutral-900 tabular-nums">{moneda(l.neto)}</dd>
          </dl>
          <p className="text-sm text-neutral-600">
            {l.contratoActivo ? AYUDA_APROBAR_LIQUIDACION : "El contrato ya no está activo: aprobar no lo cambia."}
          </p>
          {avisoContador}
        </div>
      </ConfirmDialog>

      <PagoDialog
        open={dialogo === "pagar"}
        title="Marcar como pagada"
        confirmLabel="Marcar como pagada"
        pending={pendiente}
        fechaMin={sumarDias(l.fechaEgreso, -31)}
        fechaMax={sumarDias(hoy, 31)}
        fechaInicial={hoy}
        onConfirm={(datos: DatosPago) =>
          ejecutar(
            () => pagarLiquidacion(l.id, { metodo: datos.metodo, referencia: datos.referencia, fecha: datos.fecha }),
            "Liquidación marcada como pagada."
          )
        }
        onCancel={cerrar}
      >
        <div className="flex flex-col gap-3">
          {alertaError}
          <p className="text-sm text-neutral-900">
            Neto a pagar: <span className="font-semibold tabular-nums">{moneda(l.neto)}</span> · {l.persona}
          </p>
          {avisoContador}
          <p className="text-sm text-neutral-600">Marcar como pagada no cambia los montos. Registra cómo y cuándo se pagó.</p>
        </div>
      </PagoDialog>

      <MotivoDialog
        open={dialogo === "anular"}
        title="Anular liquidación"
        description="La liquidación queda anulada. El saldo de vacaciones y las cuotas de préstamo vuelven a quedar pendientes. Esta acción no se puede deshacer."
        confirmLabel="Anular liquidación"
        destructive
        pending={pendiente}
        onConfirm={(motivo) => ejecutar(() => anularLiquidacion(l.id, motivo), "Liquidación anulada.")}
        onCancel={cerrar}
      >
        {alertaError}
        {aprobada ? (
          <p className="text-sm text-neutral-600">El contrato sigue finalizado: un contrato finalizado no se reabre.</p>
        ) : null}
      </MotivoDialog>
    </section>
  );
}
