"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Field, FormSection, Input, Select, Textarea, useToast } from "@nexo/ui";
import { sumarDias } from "@/lib/fecha-managua";
import { RUTA } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { TIPO_PRESTAMO } from "@/lib/planilla/etiquetas";
import type { TipoPrestamo } from "@/lib/planilla/tipos";
import { AlertaError } from "../../liquidaciones/_compartido/alerta-error";
import { crearPrestamo, type CrearPrestamoInput } from "../actions";

type Campo = "contrato" | "monto" | "cuotas" | "fecha" | "nota";
const NOTA_MAX = 300;
const TIPOS: readonly TipoPrestamo[] = ["prestamo", "adelanto"];

/**
 * Formulario "Nuevo préstamo" (C4). La RPC planilla_prestamo_crear arma las
 * cuotas (fecha de fin de cada período desde la primera fecha) y rechaza una
 * primera cuota en un período pasado, a más de un año o en una planilla ya
 * aprobada: aquí solo se valida el formato.
 */
export function NuevoPrestamoForm({
  personas,
  hoy,
  puedeVerLista,
}: {
  personas: { contratoId: string; etiqueta: string }[];
  hoy: string;
  puedeVerLista: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const idAg = useId();
  const [contratoId, setContratoId] = useState("");
  const [tipo, setTipo] = useState<TipoPrestamo>("prestamo");
  const [monto, setMonto] = useState("");
  const [cuotas, setCuotas] = useState("");
  const [cuotasTocadas, setCuotasTocadas] = useState(false);
  const [fecha, setFecha] = useState(hoy);
  const [deAg, setDeAg] = useState(false);
  const [nota, setNota] = useState("");
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const refContrato = useRef<HTMLSelectElement>(null);
  const refMonto = useRef<HTMLInputElement>(null);
  const refCuotas = useRef<HTMLInputElement>(null);
  const refFecha = useRef<HTMLInputElement>(null);
  const refNota = useRef<HTMLTextAreaElement>(null);

  /** Lleva el foco al campo que falló (solo en el manejador, nunca al renderizar). */
  function enfocar(campo: Campo) {
    const destino = { contrato: refContrato, monto: refMonto, cuotas: refCuotas, fecha: refFecha, nota: refNota }[campo];
    destino.current?.focus();
  }
  const fechaMax = sumarDias(hoy, 366);

  function limpiar(campo: Campo) {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    if (errorGeneral) setErrorGeneral(null);
  }

  function elegirTipo(t: TipoPrestamo) {
    setTipo(t);
    // Un adelanto suele ser de una sola cuota; no se pisa lo que la persona ya escribió.
    if (!cuotasTocadas) setCuotas(t === "adelanto" ? "1" : "");
  }

  function validar(): CrearPrestamoInput | Partial<Record<Campo, string>> {
    const e: Partial<Record<Campo, string>> = {};
    if (!personas.some((p) => p.contratoId === contratoId)) e.contrato = "Elige la persona.";
    const m = monto.trim() === "" ? Number.NaN : Number(monto);
    if (!Number.isFinite(m) || m <= 0 || m >= 100_000_000 || Math.abs(Math.round(m * 100) - m * 100) > 1e-6) {
      e.monto = "Indica un monto mayor que 0, con hasta dos decimales.";
    }
    const c = cuotas.trim() === "" ? Number.NaN : Number(cuotas);
    if (!Number.isInteger(c) || c < 1 || c > 120) e.cuotas = "Indica un número entero de cuotas, de 1 a 120.";
    if (!esFechaIso(fecha)) e.fecha = "Indica la fecha de la primera cuota.";
    else if (fecha > fechaMax) e.fecha = "La primera cuota no puede ser de más de un año adelante.";
    if (nota.trim().length > NOTA_MAX) e.nota = `La nota admite hasta ${NOTA_MAX} caracteres.`;
    if (Object.keys(e).length > 0) return e;
    return {
      contratoId,
      tipo,
      monto: m,
      cuotas: c,
      fechaPrimera: fecha,
      origen: deAg ? "ag" : "nexo",
      nota: nota.trim() || null,
    };
  }

  function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorGeneral(null);
    const resultado = validar();
    if (!("contratoId" in resultado)) {
      setErrores(resultado);
      const primero = (["contrato", "monto", "cuotas", "fecha", "nota"] as const).find((k) => resultado[k]);
      if (primero) enfocar(primero);
      return;
    }
    setErrores({});
    startTransition(async () => {
      const r = await crearPrestamo(resultado);
      if (!r.ok) {
        // Un solo canal de error: el aviso de arriba, que recibe el foco.
        setErrorGeneral(r.message);
        return;
      }
      toast.show(tipo === "adelanto" ? "Adelanto registrado." : "Préstamo registrado.", "success");
      if (puedeVerLista) {
        router.push(RUTA.prestamos());
        return;
      }
      setMonto("");
      setCuotas(tipo === "adelanto" ? "1" : "");
      setCuotasTocadas(false);
      setNota("");
    });
  }

  return (
    <form onSubmit={enviar} noValidate aria-label="Nuevo préstamo" className="flex flex-col gap-6">
      {errorGeneral ? <AlertaError title="No se pudo registrar el préstamo">{errorGeneral}</AlertaError> : null}

      <FormSection title="Persona y tipo">
        <Field label="Persona" required error={errores.contrato} hint="Solo contratos activos.">
          <Select
            ref={refContrato}
            required
            value={contratoId}
            disabled={pendiente}
            onChange={(e) => {
              setContratoId(e.target.value);
              limpiar("contrato");
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

        <fieldset className="flex flex-col gap-2" disabled={pendiente}>
          <legend className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700">
            Tipo
            <span aria-hidden="true" className="ml-0.5 text-red-600">
              *
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 ${
                  tipo === t ? "border-blue-300 bg-blue-50 text-neutral-900" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  checked={tipo === t}
                  onChange={() => elegirTipo(t)}
                  className="size-4 accent-blue-600 focus-visible:outline-none"
                />
                {TIPO_PRESTAMO[t]}
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection title="Monto y cuotas" description="Las cuotas se generan en la fecha de fin de cada período a partir de la primera fecha.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monto (C$)" required error={errores.monto} hint={deAg ? "Registra solo el saldo que falta." : undefined}>
            <Input
              ref={refMonto}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              required
              value={monto}
              disabled={pendiente}
              onChange={(e) => {
                setMonto(e.target.value);
                limpiar("monto");
              }}
            />
          </Field>
          <Field label="Número de cuotas" required error={errores.cuotas} hint="De 1 a 120.">
            <Input
              ref={refCuotas}
              type="number"
              inputMode="numeric"
              step="1"
              min={1}
              max={120}
              required
              value={cuotas}
              disabled={pendiente}
              onChange={(e) => {
                setCuotas(e.target.value);
                setCuotasTocadas(true);
                limpiar("cuotas");
              }}
            />
          </Field>
          <Field
            label="Fecha de la primera cuota"
            required
            error={errores.fecha}
            hint="Se descuenta en la planilla cuyo período incluye esta fecha."
          >
            <Input
              ref={refFecha}
              type="date"
              required
              max={fechaMax}
              value={fecha}
              disabled={pendiente}
              onChange={(e) => {
                setFecha(e.target.value);
                limpiar("fecha");
              }}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex w-fit items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={deAg}
              disabled={pendiente}
              aria-describedby={idAg}
              onChange={(e) => setDeAg(e.target.checked)}
              className="size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
            Es un préstamo vigente traído de AG Planilla
          </label>
          <p id={idAg} className="pl-6 text-xs text-neutral-500">
            Registra solo el saldo que falta: las cuotas ya cobradas en AG no se vuelven a descontar.
          </p>
        </div>

        <Field label="Nota" optional error={errores.nota} hint={`${nota.length}/${NOTA_MAX}`}>
          <Textarea
            ref={refNota}
            rows={2}
            maxLength={NOTA_MAX}
            value={nota}
            disabled={pendiente}
            onChange={(e) => {
              setNota(e.target.value);
              limpiar("nota");
            }}
          />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {puedeVerLista ? (
          <ButtonLink href={RUTA.prestamos()} variant="secondary">
            Cancelar
          </ButtonLink>
        ) : null}
        <Button type="submit" loading={pendiente}>
          {pendiente ? "Guardando…" : "Guardar préstamo"}
        </Button>
      </div>
    </form>
  );
}
