"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@nexo/ui";
import { RUTA } from "@/lib/planilla/rutas";
import { CAUSA_LIQUIDACION, NOTA_CAUSAS_PENDIENTES } from "@/lib/planilla/etiquetas";
import type { CausaLiquidacion } from "@/lib/planilla/tipos";
import { queryDe, validarSimulacion, type ErroresSimulacion, type ValoresSimulacion } from "./parametros";

export interface ContratoSimulable {
  contratoId: string;
  etiqueta: string;
  /** Fecha de fin real si el contrato está finalizado: es la fecha de egreso de su liquidación. */
  fechaFin: string | null;
}

const CAUSAS = Object.keys(CAUSA_LIQUIDACION) as CausaLiquidacion[];
const ORDEN: readonly (keyof ValoresSimulacion)[] = ["contrato", "egreso", "causa", "pendiente", "confianza", "vacaciones"];

/**
 * Formulario del simulador de liquidación (C7). El estado vive en la URL:
 * "Simular" valida el formato y navega; la página (Server Component) llama a
 * planilla_liquidacion_simular y muestra lo que devuelve. Recargar repite la
 * simulación. Con un contrato finalizado, la fecha de egreso propuesta es su
 * fecha de fin real.
 */
export function SimuladorForm({
  contratos,
  valores,
  errores: erroresIniciales,
  hoy,
}: {
  contratos: ContratoSimulable[];
  valores: ValoresSimulacion;
  errores: ErroresSimulacion;
  hoy: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<ValoresSimulacion>(() => ({ ...valores, egreso: valores.egreso || hoy }));
  const [errores, setErrores] = useState<ErroresSimulacion>(erroresIniciales);
  const [pendiente, startTransition] = useTransition();
  const refContrato = useRef<HTMLSelectElement>(null);
  const refEgreso = useRef<HTMLInputElement>(null);
  const refCausa = useRef<HTMLSelectElement>(null);
  const refPendiente = useRef<HTMLInputElement>(null);
  const refVacaciones = useRef<HTMLInputElement>(null);
  const refConfianza = useRef<HTMLInputElement>(null);
  const esConfianza = v.causa === "confianza";

  function cambiar(campo: keyof ValoresSimulacion, valor: string) {
    setV((previo) => ({ ...previo, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function elegirContrato(id: string) {
    const c = contratos.find((x) => x.contratoId === id);
    setV((previo) => ({ ...previo, contrato: id, egreso: c?.fechaFin ?? (previo.egreso || hoy) }));
    if (errores.contrato || errores.egreso) setErrores((e) => ({ ...e, contrato: undefined, egreso: undefined }));
  }

  function simular(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { valida, errores: e } = validarSimulacion(v);
    setErrores(e);
    if (!valida) {
      const primero = ORDEN.find((k) => e[k]);
      if (primero) {
        const destino = {
          contrato: refContrato,
          egreso: refEgreso,
          causa: refCausa,
          pendiente: refPendiente,
          vacaciones: refVacaciones,
          confianza: refConfianza,
        }[primero];
        destino.current?.focus();
      }
      return;
    }
    startTransition(() => router.push(RUTA.simuladorLiquidacion(queryDe(v))));
  }

  return (
    <form
      onSubmit={simular}
      noValidate
      aria-label="Datos de la simulación"
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Contrato" required error={errores.contrato} className="sm:col-span-2 lg:col-span-1" hint="Activos y finalizados.">
          <Select
            ref={refContrato}
            required
            value={v.contrato}
            disabled={pendiente}
            onChange={(e) => elegirContrato(e.target.value)}
          >
            <option value="">Elige un contrato</option>
            {contratos.map((c) => (
              <option key={c.contratoId} value={c.contratoId}>
                {c.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha de egreso" required error={errores.egreso} hint="Último día de trabajo.">
          <Input
            ref={refEgreso}
            type="date"
            required
            value={v.egreso}
            disabled={pendiente}
            onChange={(e) => cambiar("egreso", e.target.value)}
          />
        </Field>
        <Field label="Causa" required error={errores.causa} hint={NOTA_CAUSAS_PENDIENTES}>
          <Select
            ref={refCausa}
            required
            value={v.causa}
            disabled={pendiente}
            onChange={(e) => cambiar("causa", e.target.value)}
          >
            <option value="">Elige la causa</option>
            {CAUSAS.map((c) => (
              <option key={c} value={c}>
                {CAUSA_LIQUIDACION[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Días de salario pendiente"
          optional
          error={errores.pendiente}
          hint="El salario hasta el egreso se paga en la planilla del período; usa salario pendiente solo si esa planilla no se va a hacer."
        >
          <Input
            ref={refPendiente}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={31}
            placeholder="0"
            value={v.pendiente}
            disabled={pendiente}
            onChange={(e) => cambiar("pendiente", e.target.value)}
          />
        </Field>
        {esConfianza ? (
          <Field
            label="Meses adicionales del art. 47"
            optional
            error={errores.confianza}
            hint="Rango según los parámetros de ley; lo valida el sistema."
          >
            <Input
              ref={refConfianza}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={99}
              value={v.confianza}
              disabled={pendiente}
              onChange={(e) => cambiar("confianza", e.target.value)}
            />
          </Field>
        ) : null}
        <Field label="Días de vacaciones" optional error={errores.vacaciones} hint="Vacío = saldo registrado.">
          <Input
            ref={refVacaciones}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={v.vacaciones}
            disabled={pendiente}
            onChange={(e) => cambiar("vacaciones", e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="submit" loading={pendiente}>
          {pendiente ? "Simulando…" : "Simular"}
        </Button>
      </div>
    </form>
  );
}
