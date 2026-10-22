"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Field, FormSection, Input, Select, Textarea, fechaCorta, useToast } from "@nexo/ui";
import { RUTA } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { DESCRIPCION_TIPO_VACACIONES, TIPO_VACACIONES } from "@/lib/planilla/etiquetas";
import { MOTIVO_MAX, MOTIVO_MIN } from "@/lib/planilla/estados";
import { diasTexto } from "@/lib/planilla/formato";
import { AlertaError } from "../../liquidaciones/_compartido/alerta-error";
import { registrarVacaciones, type RegistrarVacacionesInput } from "../actions";

export interface PersonaVacaciones {
  contratoId: string;
  etiqueta: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  /** Saldo de hoy (planilla_vacaciones_saldos); null si el rol no ve saldos. */
  saldoHoy: number | null;
}

type Tipo = RegistrarVacacionesInput["tipo"];
type Campo = "contrato" | "fechaInicio" | "fechaFin" | "dias" | "motivo";

const TIPOS: readonly Tipo[] = ["goce", "pago", "ajuste", "saldo_inicial"];
const DIA_MS = 86_400_000;

/** Días de calendario del rango (validación de formulario; la RPC es la autoridad). */
function diasDelRango(inicio: string, fin: string): number | null {
  if (!esFechaIso(inicio) || !esFechaIso(fin) || fin < inicio) return null;
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / DIA_MS) + 1;
}

function dosDecimales(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

/**
 * Formulario "Registrar vacaciones" (C3). Tipo con descripción; goce con
 * rango de fechas; pago, ajuste y saldo inicial con una sola fecha (la RPC
 * usa esa fecha como inicio y fin). El ajuste admite días negativos. Motivo
 * obligatorio en ajuste y saldo inicial, opcional en goce y pago (D5). La
 * validación de aquí es de formato: el saldo, el corte del saldo inicial y
 * los solapes los valida planilla_vacaciones_registrar.
 */
export function RegistrarVacacionesForm({
  personas,
  contratoInicial,
  hoy,
  verSaldo,
  puedeVerMovimientos,
}: {
  personas: PersonaVacaciones[];
  contratoInicial: string;
  hoy: string;
  verSaldo: boolean;
  puedeVerMovimientos: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [contratoId, setContratoId] = useState(contratoInicial);
  const [tipo, setTipo] = useState<Tipo>("goce");
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [dias, setDias] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const refContrato = useRef<HTMLSelectElement>(null);
  const refFechaInicio = useRef<HTMLInputElement>(null);
  const refFechaFin = useRef<HTMLInputElement>(null);
  const refDias = useRef<HTMLInputElement>(null);
  const refMotivo = useRef<HTMLTextAreaElement>(null);

  /** Lleva el foco al campo que falló (solo en el manejador, nunca al renderizar). */
  function enfocar(campo: Campo) {
    const destino = { contrato: refContrato, fechaInicio: refFechaInicio, fechaFin: refFechaFin, dias: refDias, motivo: refMotivo }[campo];
    destino.current?.focus();
  }

  const persona = personas.find((p) => p.contratoId === contratoId) ?? null;
  const esGoce = tipo === "goce";
  const motivoObligatorio = tipo === "ajuste" || tipo === "saldo_inicial";
  const rango = esGoce ? diasDelRango(fechaInicio, fechaFin) : null;

  function limpiarError(campo: Campo) {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    if (errorGeneral) setErrorGeneral(null);
  }

  function validar(): { input: RegistrarVacacionesInput | null; errores: Partial<Record<Campo, string>> } {
    const e: Partial<Record<Campo, string>> = {};
    if (!persona) e.contrato = "Elige la persona.";
    if (!esFechaIso(fechaInicio)) e.fechaInicio = "Indica la fecha.";
    else if (persona?.fechaInicio && fechaInicio < persona.fechaInicio) {
      e.fechaInicio = `El contrato empieza el ${fechaCorta(persona.fechaInicio)}.`;
    }
    if (esGoce) {
      if (!esFechaIso(fechaFin)) e.fechaFin = "Indica el último día de vacaciones.";
      else if (esFechaIso(fechaInicio) && fechaFin < fechaInicio) e.fechaFin = "Debe ser igual o posterior al primer día.";
      else if (persona?.fechaFin && fechaFin > persona.fechaFin) e.fechaFin = `El contrato terminó el ${fechaCorta(persona.fechaFin)}.`;
    } else if (persona?.fechaFin && esFechaIso(fechaInicio) && fechaInicio > persona.fechaFin) {
      e.fechaInicio = `El contrato terminó el ${fechaCorta(persona.fechaFin)}.`;
    }
    const n = dias.trim() === "" ? Number.NaN : Number(dias);
    if (!Number.isFinite(n) || !dosDecimales(n) || Math.abs(n) >= 1000) e.dias = "Indica los días, con hasta dos decimales.";
    else if ((tipo === "goce" || tipo === "pago") && n <= 0) e.dias = "Los días deben ser mayores que 0.";
    else if (tipo === "ajuste" && n === 0) e.dias = "Un ajuste no puede ser de 0 días. Usa un número negativo para restar.";
    else if (tipo === "saldo_inicial" && n < 0) e.dias = "El saldo inicial no puede ser negativo.";
    else if (esGoce && rango !== null && n > rango) e.dias = `No pueden ser más de ${diasTexto(rango)}, los del rango de fechas.`;
    const largo = motivo.trim().length;
    if (motivoObligatorio && largo < MOTIVO_MIN) e.motivo = `Escribe el motivo (al menos ${MOTIVO_MIN} caracteres).`;
    else if (largo > MOTIVO_MAX) e.motivo = `El motivo es demasiado largo (hasta ${MOTIVO_MAX} caracteres).`;

    if (Object.keys(e).length > 0 || !persona) return { input: null, errores: e };
    return {
      input: {
        contratoId: persona.contratoId,
        tipo,
        fechaInicio,
        fechaFin: esGoce ? fechaFin : null,
        dias: n,
        motivo: motivo.trim() || null,
      },
      errores: e,
    };
  }

  function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { input, errores: e } = validar();
    setErrores(e);
    setErrorGeneral(null);
    if (!input) {
      const primero = (["contrato", "fechaInicio", "fechaFin", "dias", "motivo"] as const).find((c) => e[c]);
      if (primero) enfocar(primero);
      return;
    }
    startTransition(async () => {
      const r = await registrarVacaciones(input);
      if (!r.ok) {
        // Un solo canal de error: el aviso de arriba, que recibe el foco.
        setErrorGeneral(r.message);
        return;
      }
      toast.show("Movimiento registrado. Queda pendiente de aprobación.", "success");
      if (puedeVerMovimientos) {
        router.push(RUTA.vacacionesMovimientos({ estado: "solicitada" }));
        return;
      }
      setDias("");
      setMotivo("");
    });
  }

  const saldo = verSaldo && persona ? persona.saldoHoy : null;

  return (
    <form onSubmit={enviar} noValidate aria-label="Registrar vacaciones" className="flex flex-col gap-6">
      {errorGeneral ? <AlertaError title="No se pudo registrar el movimiento">{errorGeneral}</AlertaError> : null}

      <FormSection title="Persona">
        <Field
          label="Persona"
          required
          error={errores.contrato}
          hint={
            saldo !== null
              ? `Saldo al día de hoy: ${diasTexto(saldo)}${saldo < 0 ? " (negativo)" : ""}`
              : "Contratos activos y finalizados."
          }
        >
          <Select
            ref={refContrato}
            required
            value={contratoId}
            disabled={pendiente}
            onChange={(e) => {
              setContratoId(e.target.value);
              limpiarError("contrato");
            }}
          >
            <option value="">Elige una persona</option>
            {personas.map((p) => (
              <option key={p.contratoId} value={p.contratoId}>
                {p.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection title="Movimiento">
        <fieldset className="flex flex-col gap-2" disabled={pendiente}>
          <legend className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700">
            Tipo de movimiento
            <span aria-hidden="true" className="ml-0.5 text-red-600">
              *
            </span>
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TIPOS.map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 ${
                  tipo === t ? "border-blue-300 bg-blue-50" : "border-neutral-200 bg-white hover:bg-neutral-50"
                }`}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  checked={tipo === t}
                  onChange={() => {
                    setTipo(t);
                    setErrores({});
                    setErrorGeneral(null);
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-blue-600 focus-visible:outline-none"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-neutral-900">{TIPO_VACACIONES[t]}</span>
                  <span className="text-xs text-neutral-500">{DESCRIPCION_TIPO_VACACIONES[t]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={esGoce ? "Fecha de inicio" : "Fecha"}
            required
            error={errores.fechaInicio}
            hint={
              tipo === "pago"
                ? "Entra como novedad en la planilla cuyo período incluye esta fecha."
                : tipo === "saldo_inicial"
                  ? "Fecha de corte: el saldo incluye lo ocurrido hasta ese día."
                  : esGoce
                    ? "Primer día de vacaciones."
                    : undefined
            }
          >
            <Input
              ref={refFechaInicio}
              type="date"
              required
              value={fechaInicio}
              min={persona?.fechaInicio ?? undefined}
              max={persona?.fechaFin ?? undefined}
              disabled={pendiente}
              onChange={(e) => {
                const valor = e.target.value;
                setFechaInicio(valor);
                // El fin acompaña al inicio si quedaría antes (solo se usa en un goce).
                if (esFechaIso(valor) && esFechaIso(fechaFin) && fechaFin < valor) setFechaFin(valor);
                limpiarError("fechaInicio");
              }}
            />
          </Field>
          {esGoce ? (
            <Field label="Fecha de fin" required error={errores.fechaFin} hint="Último día de vacaciones.">
              <Input
                ref={refFechaFin}
                type="date"
                required
                value={fechaFin}
                min={esFechaIso(fechaInicio) ? fechaInicio : undefined}
                max={persona?.fechaFin ?? undefined}
                disabled={pendiente}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  limpiarError("fechaFin");
                }}
              />
            </Field>
          ) : null}
          <Field
            label="Días"
            required
            error={errores.dias}
            hint={
              tipo === "ajuste"
                ? "Usa un número negativo para restar días. Hasta dos decimales."
                : esGoce && rango !== null
                  ? `Días que descansa, hasta ${diasTexto(rango)}. Hasta dos decimales.`
                  : "Hasta dos decimales."
            }
          >
            <Input
              ref={refDias}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={tipo === "ajuste" ? undefined : 0}
              max={999.99}
              required
              value={dias}
              disabled={pendiente}
              onChange={(e) => {
                setDias(e.target.value);
                limpiarError("dias");
              }}
            />
          </Field>
        </div>

        <Field
          label="Motivo"
          required={motivoObligatorio}
          optional={!motivoObligatorio}
          error={errores.motivo}
          hint={`${motivoObligatorio ? `Obligatorio, de ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres` : `Hasta ${MOTIVO_MAX} caracteres`} · ${motivo.length}/${MOTIVO_MAX}`}
        >
          <Textarea
            ref={refMotivo}
            rows={3}
            maxLength={MOTIVO_MAX}
            required={motivoObligatorio}
            value={motivo}
            disabled={pendiente}
            onChange={(e) => {
              setMotivo(e.target.value);
              limpiarError("motivo");
            }}
          />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {puedeVerMovimientos ? (
          <ButtonLink href={RUTA.vacaciones()} variant="secondary">
            Cancelar
          </ButtonLink>
        ) : null}
        <Button type="submit" loading={pendiente}>
          {pendiente ? "Registrando…" : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
