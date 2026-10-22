"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Field, FormSection, Input, Select, Textarea, fechaCorta, useToast } from "@nexo/ui";
import { RUTA } from "@/lib/planilla/rutas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { METODO_EMBARGO, TIPO_EMBARGO } from "@/lib/planilla/etiquetas";
import type { MetodoEmbargo, TipoEmbargo } from "@/lib/planilla/tipos";
import { AlertaError } from "../../liquidaciones/_compartido/alerta-error";
import { crearEmbargo, type CrearEmbargoInput } from "../actions";

type Campo = "contrato" | "valor" | "tope" | "referencia" | "desde" | "hasta" | "nota";
const ORDEN: readonly Campo[] = ["contrato", "valor", "tope", "referencia", "desde", "hasta", "nota"];
const NOTA_MAX = 300;
const REFERENCIA_MAX = 200;
const TIPOS: readonly TipoEmbargo[] = ["alimentos", "judicial"];
const METODOS: readonly MetodoEmbargo[] = ["porcentaje", "monto"];

function numeroDe(texto: string): number {
  return texto.trim() === "" ? Number.NaN : Number(texto);
}

function dosDecimales(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

const CLASE_OPCION =
  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600";
const OPCION_ACTIVA = "border-blue-300 bg-blue-50 text-neutral-900";
const OPCION_INACTIVA = "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50";

/**
 * Formulario "Nuevo embargo" (C5). El porcentaje se escribe de 0 a 100 y la
 * Server Action lo envía como fracción (aFraccion); el monto es MENSUAL. La
 * RPC planilla_embargo_crear vuelve a validar todo (contrato activo, vigencia
 * dentro del contrato, referencia).
 */
export function NuevoEmbargoForm({
  personas,
  hoy,
  puedeVerLista,
}: {
  personas: { contratoId: string; etiqueta: string; fechaInicio: string | null }[];
  hoy: string;
  puedeVerLista: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [contratoId, setContratoId] = useState("");
  const [tipo, setTipo] = useState<TipoEmbargo>("alimentos");
  const [metodo, setMetodo] = useState<MetodoEmbargo>("porcentaje");
  const [valor, setValor] = useState("");
  const [tope, setTope] = useState("");
  const [referencia, setReferencia] = useState("");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState("");
  const [nota, setNota] = useState("");
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const refContrato = useRef<HTMLSelectElement>(null);
  const refValor = useRef<HTMLInputElement>(null);
  const refTope = useRef<HTMLInputElement>(null);
  const refReferencia = useRef<HTMLInputElement>(null);
  const refDesde = useRef<HTMLInputElement>(null);
  const refHasta = useRef<HTMLInputElement>(null);
  const refNota = useRef<HTMLTextAreaElement>(null);

  /** Lleva el foco al campo que falló (solo en el manejador, nunca al renderizar). */
  function enfocar(campo: Campo) {
    const destino = {
      contrato: refContrato,
      valor: refValor,
      tope: refTope,
      referencia: refReferencia,
      desde: refDesde,
      hasta: refHasta,
      nota: refNota,
    }[campo];
    destino.current?.focus();
  }

  const persona = personas.find((p) => p.contratoId === contratoId) ?? null;
  const esPorcentaje = metodo === "porcentaje";

  function limpiar(campo: Campo) {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    if (errorGeneral) setErrorGeneral(null);
  }

  function validar(): CrearEmbargoInput | Partial<Record<Campo, string>> {
    const e: Partial<Record<Campo, string>> = {};
    if (!persona) e.contrato = "Elige la persona.";
    const v = numeroDe(valor);
    if (!Number.isFinite(v) || v <= 0 || !dosDecimales(v)) {
      e.valor = esPorcentaje ? "Indica un porcentaje mayor que 0 y hasta 100." : "Indica un monto mensual mayor que 0.";
    } else if (esPorcentaje && v > 100) e.valor = "El porcentaje no puede ser mayor que 100.";
    else if (!esPorcentaje && v >= 100_000_000) e.valor = "El monto mensual no es válido.";
    const t = tope.trim() === "" ? null : numeroDe(tope);
    if (t !== null && (!Number.isFinite(t) || t <= 0 || !dosDecimales(t))) e.tope = "Indica un monto mayor que 0 o déjalo vacío.";
    const ref = referencia.trim();
    if (ref.length < 3) e.referencia = "Indica el N.º de expediente u oficio (al menos 3 caracteres).";
    else if (ref.length > REFERENCIA_MAX) e.referencia = `La referencia admite hasta ${REFERENCIA_MAX} caracteres.`;
    if (!esFechaIso(desde)) e.desde = "Indica desde cuándo rige.";
    else if (persona?.fechaInicio && desde < persona.fechaInicio) {
      e.desde = `El embargo no puede empezar antes del contrato (${fechaCorta(persona.fechaInicio)}).`;
    }
    const h = hasta.trim() === "" ? null : hasta;
    if (h !== null && (!esFechaIso(h) || (esFechaIso(desde) && h < desde))) e.hasta = "Debe ser igual o posterior a «Vigente desde».";
    if (nota.trim().length > NOTA_MAX) e.nota = `La nota admite hasta ${NOTA_MAX} caracteres.`;
    if (Object.keys(e).length > 0 || !persona) return e;
    return {
      contratoId: persona.contratoId,
      tipo,
      metodo,
      valor: v,
      topeTotal: t,
      referencia: ref,
      vigenteDesde: desde,
      vigenteHasta: h,
      nota: nota.trim() || null,
    };
  }

  function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorGeneral(null);
    const resultado = validar();
    if (!("contratoId" in resultado)) {
      setErrores(resultado);
      const primero = ORDEN.find((k) => resultado[k]);
      if (primero) enfocar(primero);
      return;
    }
    setErrores({});
    startTransition(async () => {
      const r = await crearEmbargo(resultado);
      if (!r.ok) {
        // Un solo canal de error: el aviso de arriba, que recibe el foco.
        setErrorGeneral(r.message);
        return;
      }
      toast.show("Embargo registrado.", "success");
      if (puedeVerLista) {
        router.push(RUTA.embargos());
        return;
      }
      setValor("");
      setTope("");
      setReferencia("");
      setHasta("");
      setNota("");
    });
  }

  return (
    <form onSubmit={enviar} noValidate aria-label="Nuevo embargo" className="flex flex-col gap-6">
      {errorGeneral ? <AlertaError title="No se pudo registrar el embargo">{errorGeneral}</AlertaError> : null}

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
              <label key={t} className={`${CLASE_OPCION} ${tipo === t ? OPCION_ACTIVA : OPCION_INACTIVA}`}>
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  checked={tipo === t}
                  onChange={() => setTipo(t)}
                  className="size-4 accent-blue-600 focus-visible:outline-none"
                />
                {TIPO_EMBARGO[t]}
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection title="Descuento">
        <fieldset className="flex flex-col gap-2" disabled={pendiente}>
          <legend className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700">
            Método
            <span aria-hidden="true" className="ml-0.5 text-red-600">
              *
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {METODOS.map((m) => (
              <label key={m} className={`${CLASE_OPCION} ${metodo === m ? OPCION_ACTIVA : OPCION_INACTIVA}`}>
                <input
                  type="radio"
                  name="metodo"
                  value={m}
                  checked={metodo === m}
                  onChange={() => {
                    setMetodo(m);
                    setValor("");
                    limpiar("valor");
                  }}
                  className="size-4 accent-blue-600 focus-visible:outline-none"
                />
                {METODO_EMBARGO[m]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={esPorcentaje ? "Porcentaje (%)" : "Monto mensual (C$)"}
            required
            error={errores.valor}
            hint={
              esPorcentaje
                ? "De 0 a 100. Se aplica sobre el devengado menos INSS laboral e IR."
                : "Monto al mes; en cada planilla se prorratea por los días de vigencia."
            }
          >
            <Input
              ref={refValor}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              max={esPorcentaje ? 100 : undefined}
              required
              value={valor}
              disabled={pendiente}
              onChange={(e) => {
                setValor(e.target.value);
                limpiar("valor");
              }}
            />
          </Field>
          <Field label="Tope total de la orden (C$)" optional error={errores.tope} hint="Vacío si la orden no tiene monto total.">
            <Input
              ref={refTope}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              value={tope}
              disabled={pendiente}
              onChange={(e) => {
                setTope(e.target.value);
                limpiar("tope");
              }}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Orden judicial">
        <Field label="Referencia de la orden" required error={errores.referencia} hint="N.º de expediente u oficio.">
          <Input
            ref={refReferencia}
            required
            maxLength={REFERENCIA_MAX}
            autoComplete="off"
            value={referencia}
            disabled={pendiente}
            onChange={(e) => {
              setReferencia(e.target.value);
              limpiar("referencia");
            }}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vigente desde" required error={errores.desde}>
            <Input
              ref={refDesde}
              type="date"
              required
              min={persona?.fechaInicio ?? undefined}
              value={desde}
              disabled={pendiente}
              onChange={(e) => {
                setDesde(e.target.value);
                limpiar("desde");
              }}
            />
          </Field>
          <Field label="Vigente hasta" optional error={errores.hasta} hint="Vacío si la orden no tiene fecha de fin.">
            <Input
              ref={refHasta}
              type="date"
              min={esFechaIso(desde) ? desde : undefined}
              value={hasta}
              disabled={pendiente}
              onChange={(e) => {
                setHasta(e.target.value);
                limpiar("hasta");
              }}
            />
          </Field>
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
          <ButtonLink href={RUTA.embargos()} variant="secondary">
            Cancelar
          </ButtonLink>
        ) : null}
        <Button type="submit" loading={pendiente}>
          {pendiente ? "Guardando…" : "Guardar embargo"}
        </Button>
      </div>
    </form>
  );
}
