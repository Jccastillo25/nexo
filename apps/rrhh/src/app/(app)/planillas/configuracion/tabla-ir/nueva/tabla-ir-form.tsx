"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ConfirmDialog, Field, Input, NexoIcon, fechaCorta, moneda, useToast } from "@nexo/ui";
import { sumarDias } from "@/lib/fecha-managua";
import { CERTEZA } from "@/lib/planilla/etiquetas";
import { aFraccion } from "@/lib/planilla/formato";
import { esFechaIso } from "@/lib/planilla/periodos";
import { RUTA } from "@/lib/planilla/rutas";
import type { Certeza, IrTramoEntrada } from "@/lib/planilla/tipos";
import { AlertaError } from "../../_compartido/alerta-error";
import { guardarTablaIr } from "../actions";

/** Tramo de la tabla precargada en el formulario (porcentaje ya en %). */
export interface TramoInicial {
  desde: number;
  hasta: number | null;
  impuesto_base: number;
  /** De 0 a 100 (null si el dato guardado no se pudo leer: el campo queda vacío). */
  porcentaje: number | null;
  sobre_exceso: number;
}

/** Tabla que empieza después de hoy: la nueva la reemplaza si empieza en su fecha o antes. */
export interface TablaProgramada {
  /** "YYYY-MM-DD" (vigente_desde). */
  desde: string;
  /** Número de tramos. */
  tramos: number;
}

interface FilaTramo {
  clave: string;
  desde: string;
  hasta: string;
  base: string;
  pct: string;
  exceso: string;
}

type Campo = "desde" | "hasta" | "base" | "pct" | "exceso";
type ErroresFila = Partial<Record<Campo, string>>;

interface Errores {
  vigenteDesde?: string;
  fuente?: string;
  tramos?: string;
  filas: Record<string, ErroresFila>;
}

const MAX_TRAMOS = 20;
const MONTO = /^\d{1,12}(\.\d{1,2})?$/;
const PORCENTAJE = /^\d{1,3}(\.\d{1,2})?$/;
const RADIO =
  "mt-0.5 size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
// Sin literales `10000n`: el proyecto compila con target ES2017.
const CIEN = BigInt(100);
const DIEZ_MIL = BigInt(10000);
const MEDIO = BigInt(5000);
const CERO = BigInt(0);

/** Texto ya validado con MONTO → centavos enteros (comparaciones exactas, sin coma flotante). */
function centavos(texto: string): number {
  const [entero, dec = ""] = texto.trim().split(".");
  return Number(entero) * 100 + Number(dec.padEnd(2, "0"));
}

/** Texto ya validado con MONTO o PORCENTAJE (hasta 2 decimales) → valor × 100 como bigint. */
function porCien(texto: string): bigint {
  const [entero, dec = ""] = texto.trim().split(".");
  return BigInt(entero) * CIEN + BigInt(dec.padEnd(2, "0"));
}

function porcentajeValido(texto: string): boolean {
  return PORCENTAJE.test(texto.trim()) && Number(texto) <= 100;
}

/**
 * Impuesto al final de un tramo, en centavos, con la misma fórmula y el mismo
 * redondeo que planilla_ir_tabla_nueva: round(base + (hasta − exceso) × pct, 2),
 * con pct = % / 100 (redondeo a la mitad, alejándose de cero). Se calcula en
 * diezmilésimas de centavo con bigint: base en centavos × 10 000 + (hasta −
 * exceso) en centavos × % en centésimas. Null si a la fila le falta un dato válido.
 */
function impuestoAlFinal(f: FilaTramo): number | null {
  if (!MONTO.test(f.hasta.trim()) || !MONTO.test(f.base.trim()) || !MONTO.test(f.exceso.trim()) || !porcentajeValido(f.pct)) {
    return null;
  }
  const n = porCien(f.base) * DIEZ_MIL + (porCien(f.hasta) - porCien(f.exceso)) * porCien(f.pct);
  const redondeado = n >= CERO ? (n + MEDIO) / DIEZ_MIL : -((-n + MEDIO) / DIEZ_MIL);
  return Number(redondeado);
}

function filaDe(t: TramoInicial, i: number): FilaTramo {
  return {
    clave: `t${i}`,
    desde: String(t.desde),
    hasta: t.hasta === null ? "" : String(t.hasta),
    base: String(t.impuesto_base),
    pct: t.porcentaje === null ? "" : String(t.porcentaje),
    exceso: String(t.sobre_exceso),
  };
}

/**
 * Validación en el cliente, con las mismas reglas que la RPC (que sigue
 * siendo la autoridad): al menos un tramo, montos ≥ 0 con 2 decimales, % de 0
 * a 100, el primero empieza en 0 con impuesto base 0 y exceso 0, cada desde =
 * hasta anterior + 0.01, desde < hasta, solo el último sin hasta (su campo va
 * deshabilitado) y, desde el tramo 2, sin saltos de impuesto: "sobre el
 * exceso de" = hasta del tramo anterior e impuesto base = impuesto al final
 * del tramo anterior (impuestoAlFinal, en centavos).
 */
function validarTramos(filas: readonly FilaTramo[]): Pick<Errores, "tramos" | "filas"> {
  const errores: Record<string, ErroresFila> = {};
  if (filas.length < 1) return { tramos: "Agrega al menos un tramo.", filas: errores };
  if (filas.length > MAX_TRAMOS) return { tramos: `La tabla admite hasta ${MAX_TRAMOS} tramos.`, filas: errores };
  filas.forEach((f, i) => {
    const e: ErroresFila = {};
    const ultimo = i === filas.length - 1;
    const previo = i > 0 ? filas[i - 1] : null;
    if (!MONTO.test(f.desde.trim())) e.desde = "Indica un monto de 0 en adelante, con hasta 2 decimales.";
    if (!ultimo && !MONTO.test(f.hasta.trim())) e.hasta = "Indica el límite superior (solo el último tramo va sin él).";
    if (!MONTO.test(f.base.trim())) e.base = "Indica un monto de 0 en adelante, con hasta 2 decimales.";
    if (!porcentajeValido(f.pct)) e.pct = "Indica un porcentaje de 0 a 100, con hasta 2 decimales.";
    if (!MONTO.test(f.exceso.trim())) e.exceso = "Indica un monto de 0 en adelante, con hasta 2 decimales.";

    if (!e.desde) {
      const desde = centavos(f.desde);
      if (i === 0 && desde !== 0) e.desde = "El primer tramo empieza en 0.";
      if (previo && MONTO.test(previo.hasta.trim())) {
        const esperado = centavos(previo.hasta) + 1;
        if (desde !== esperado) e.desde = `Debe empezar en ${moneda(esperado / 100)} (el límite anterior + C$ 0.01).`;
      }
      if (!ultimo && !e.hasta && centavos(f.hasta) <= desde) e.hasta = "Debe ser mayor que el inicio del tramo.";
      if (i === 0 && !e.exceso && centavos(f.exceso) > desde) e.exceso = "No puede pasar del inicio del tramo.";
    }

    if (i === 0) {
      if (!e.base && centavos(f.base) !== 0) e.base = "En el primer tramo el impuesto base es 0.";
    } else if (previo) {
      if (!e.exceso && MONTO.test(previo.hasta.trim()) && centavos(f.exceso) !== centavos(previo.hasta)) {
        e.exceso = `Debe ser ${moneda(centavos(previo.hasta) / 100)}: el límite superior del tramo ${i}.`;
      }
      const esperado = impuestoAlFinal(previo);
      if (!e.base && esperado !== null && centavos(f.base) !== esperado) {
        e.base = `Debe ser ${moneda(esperado / 100)}: el impuesto al final del tramo ${i}.`;
      }
    }
    if (Object.keys(e).length > 0) errores[f.clave] = e;
  });
  return { filas: errores };
}

function aEntrada(filas: readonly FilaTramo[]): IrTramoEntrada[] {
  return filas.map((f, i) => ({
    desde: Number(f.desde.trim()),
    hasta: i === filas.length - 1 ? null : Number(f.hasta.trim()),
    impuesto_base: Number(f.base.trim()),
    porcentaje: aFraccion(Number(f.pct.trim())),
    sobre_exceso: Number(f.exceso.trim()),
  }));
}

/** ¿Empieza el día 1 o el 16? (la RPC solo acepta el inicio de un período). */
function esInicioDePeriodo(fecha: string): boolean {
  const dia = fecha.slice(8, 10);
  return dia === "01" || dia === "16";
}

/**
 * Qué pasa con las tablas existentes si la nueva empieza en `fecha` (ya
 * validada): se reemplazan las programadas que empiezan en esa fecha o
 * después, y la última que empieza antes (la vigente hoy o una programada) se
 * cierra el día anterior. La RPC hace exactamente esto y valida el resto.
 */
function efectoDe(fecha: string, vigenteHoy: string | null, programadas: readonly TablaProgramada[]) {
  const reemplazadas = programadas.filter((p) => p.desde >= fecha);
  const anteriores = [vigenteHoy, ...programadas.map((p) => p.desde)].filter((d): d is string => d !== null && d < fecha);
  const cierra = anteriores.length > 0 ? anteriores.reduce((a, b) => (a > b ? a : b)) : null;
  return { reemplazadas, cierra };
}

function textoTramos(n: number): string {
  return n === 1 ? "1 tramo" : `${n} tramos`;
}

/**
 * A7. Nueva tabla de IR: filas editables precargadas con la última tabla
 * cargada, vigencia, certeza y fuente. La fecha mínima es el día siguiente al
 * inicio de la tabla que rige hoy; si la nueva empieza antes que una tabla
 * programada, el diálogo de confirmación avisa que esa tabla se reemplaza.
 * Guarda con planilla_ir_tabla_nueva; si la RPC lo rechaza (p. ej. la tabla
 * programada ya se usó en una planilla), el diálogo sigue abierto con su
 * mensaje tal cual.
 */
export function TablaIrForm({
  tramosIniciales,
  precargadaDesde,
  vigenteHoy,
  programadas,
}: {
  tramosIniciales: TramoInicial[];
  /** Inicio de la tabla con la que se precargaron los tramos (null si no hay ninguna). */
  precargadaDesde: string | null;
  /** Inicio de la tabla que rige hoy: la nueva debe empezar después. */
  vigenteHoy: string | null;
  /** Tablas que empiezan después de hoy, de la más antigua a la más reciente. */
  programadas: TablaProgramada[];
}) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [filas, setFilas] = useState<FilaTramo[]>(() =>
    tramosIniciales.length > 0
      ? tramosIniciales.map(filaDe)
      : [{ clave: "t0", desde: "0", hasta: "", base: "0", pct: "0", exceso: "0" }]
  );
  const [siguiente, setSiguiente] = useState(tramosIniciales.length + 1);
  const [vigenteDesde, setVigenteDesde] = useState("");
  const [certeza, setCerteza] = useState<Certeza>("verificar");
  const [fuente, setFuente] = useState("");
  const [errores, setErrores] = useState<Errores>({ filas: {} });
  /** "Revisa los campos marcados.": arriba del formulario. */
  const [aviso, setAviso] = useState<string | null>(null);
  /** Error de la RPC al guardar: dentro del diálogo de confirmación. */
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const minimo = vigenteHoy ? sumarDias(vigenteHoy, 1) : undefined;
  const fechaValida = esFechaIso(vigenteDesde);
  const fechaAceptable = fechaValida && esInicioDePeriodo(vigenteDesde) && (!minimo || vigenteDesde >= minimo);
  const efecto = fechaAceptable ? efectoDe(vigenteDesde, vigenteHoy, programadas) : null;
  const alTope = filas.length >= MAX_TRAMOS;

  function cambiarCampo(clave: string, campo: Campo, valor: string) {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  }

  function agregar() {
    if (filas.length >= MAX_TRAMOS) return;
    setFilas((prev) => [...prev, { clave: `n${siguiente}`, desde: "", hasta: "", base: "", pct: "", exceso: "" }]);
    setSiguiente((n) => n + 1);
  }

  function quitar(clave: string) {
    setFilas((prev) => prev.filter((f) => f.clave !== clave));
  }

  function revisar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nuevos: Errores = { ...validarTramos(filas) };
    if (!fechaValida) nuevos.vigenteDesde = "Indica desde qué fecha rige la tabla.";
    else if (!esInicioDePeriodo(vigenteDesde)) nuevos.vigenteDesde = "La tabla empieza el día 1 o el 16 de un mes.";
    else if (vigenteHoy && minimo && vigenteDesde < minimo) {
      nuevos.vigenteDesde = `La nueva tabla debe empezar después del ${fechaCorta(vigenteHoy)}: la tabla de esa fecha ya rige.`;
    }
    const f = fuente.trim();
    if (f.length < 3 || f.length > 200) nuevos.fuente = "Indica la fuente (3 a 200 caracteres).";
    setErrores(nuevos);
    if (nuevos.vigenteDesde || nuevos.fuente || nuevos.tramos || Object.keys(nuevos.filas).length > 0) {
      setAviso("Revisa los campos marcados.");
      return;
    }
    setAviso(null);
    setError(null);
    setConfirmando(true);
  }

  function cancelar() {
    if (pendiente) return;
    setConfirmando(false);
    setError(null);
  }

  function guardar() {
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    startTransition(async () => {
      const r = await guardarTablaIr({ vigenteDesde, tramos: aEntrada(filas), certeza, fuente: fuente.trim() });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setConfirmando(false);
      toast.show(`Tabla de IR guardada: rige desde ${fechaCorta(vigenteDesde)}.`, "success");
      router.push(RUTA.tablaIr());
    });
  }

  const hintFecha = !fechaAceptable
    ? `Empieza el día 1 o el 16 de un mes.${vigenteHoy ? ` Después del ${fechaCorta(vigenteHoy)}, la tabla vigente hoy.` : ""}`
    : `Empieza el día 1 o el 16 de un mes.${
        efecto?.cierra ? ` La tabla del ${fechaCorta(efecto.cierra)} se cierra el ${fechaCorta(sumarDias(vigenteDesde, -1))}.` : ""
      }${
        efecto && efecto.reemplazadas.length > 0
          ? ` Reemplaza ${
              efecto.reemplazadas.length === 1
                ? `la tabla programada del ${fechaCorta(efecto.reemplazadas[0].desde)}`
                : `${efecto.reemplazadas.length} tablas programadas`
            }.`
          : ""
      }`;

  const reemplazos = efecto?.reemplazadas ?? [];
  const contenidoDialogo =
    reemplazos.length > 0 || error ? (
      <div className="flex flex-col gap-3">
        {error ? <AlertaError title="No se pudo guardar la tabla">{error}</AlertaError> : null}
        {reemplazos.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-800">
            {reemplazos.map((p) => (
              <li key={p.desde}>
                Se reemplaza la tabla programada del {fechaCorta(p.desde)} ({textoTramos(p.tramos)}); queda registrada en la
                auditoría.
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    ) : null;

  return (
    <form onSubmit={revisar} noValidate className="flex flex-col gap-6">
      {aviso ? <AlertaError title="No se pudo guardar la tabla">{aviso}</AlertaError> : null}

      <section
        aria-labelledby={`${id}-vigencia`}
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
      >
        <h2 id={`${id}-vigencia`} className="text-sm font-semibold text-neutral-900">
          Vigencia y fuente
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vigente desde" required error={errores.vigenteDesde} hint={hintFecha}>
            <Input
              type="date"
              min={minimo}
              value={vigenteDesde}
              onChange={(e) => setVigenteDesde(e.target.value)}
              disabled={pendiente}
              required
            />
          </Field>
          <Field label="Fuente" required error={errores.fuente} hint="Ejemplo: Ley 822, artículo 23, reformado por la Ley 891.">
            <Input
              value={fuente}
              onChange={(e) => setFuente(e.target.value)}
              maxLength={200}
              autoComplete="off"
              disabled={pendiente}
              required
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700">
            Certeza
            <span aria-hidden="true" className="ml-0.5 text-red-600">
              *
            </span>
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {(Object.keys(CERTEZA) as Certeza[]).map((c) => (
              <label key={c} className="flex items-start gap-2 text-sm text-neutral-800">
                <input
                  type="radio"
                  name={`${id}-certeza`}
                  className={RADIO}
                  checked={certeza === c}
                  onChange={() => setCerteza(c)}
                  disabled={pendiente}
                />
                <span>
                  {CERTEZA[c].label}
                  <span className="block text-xs text-neutral-500">{CERTEZA[c].descripcion}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section
        aria-labelledby={`${id}-tramos`}
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-tramos`} className="text-sm font-semibold text-neutral-900">
            Tramos (renta neta anual en C$)
          </h2>
          <p className="text-xs text-neutral-500">
            Cada tramo empieza donde termina el anterior más C$ 0.01. El último va sin límite superior.
          </p>
          <p className="text-xs text-neutral-500">
            Los tramos se encadenan para que el impuesto no salte: en el primero el impuesto base es 0. Desde el segundo, «Sobre
            el exceso de» es el límite superior del tramo anterior, y el impuesto base es el impuesto al final del tramo
            anterior: su impuesto base + (su límite superior − su «sobre el exceso de») × su porcentaje.
          </p>
          {precargadaDesde ? (
            <p className="text-xs text-neutral-500">Precargados con la tabla del {fechaCorta(precargadaDesde)}.</p>
          ) : null}
        </div>
        {errores.tramos ? <Alert tone="warning">{errores.tramos}</Alert> : null}
        <ol className="flex flex-col gap-4">
          {filas.map((f, i) => {
            const e = errores.filas[f.clave] ?? {};
            const ultimo = i === filas.length - 1;
            return (
              <li key={f.clave}>
                <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
                  <legend className="px-1 text-xs font-semibold text-neutral-700">Tramo {i + 1}</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Desde (C$)" required error={e.desde}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={f.desde}
                        onChange={(ev) => cambiarCampo(f.clave, "desde", ev.target.value)}
                        disabled={pendiente}
                        required
                      />
                    </Field>
                    <Field label="Hasta (C$)" required={!ultimo} error={e.hasta} hint={ultimo ? "En adelante" : undefined}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={ultimo ? "" : f.hasta}
                        placeholder={ultimo ? "En adelante" : undefined}
                        onChange={(ev) => cambiarCampo(f.clave, "hasta", ev.target.value)}
                        disabled={ultimo || pendiente}
                        required={!ultimo}
                      />
                    </Field>
                    <Field label="Impuesto base (C$)" required error={e.base}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={f.base}
                        onChange={(ev) => cambiarCampo(f.clave, "base", ev.target.value)}
                        disabled={pendiente}
                        required
                      />
                    </Field>
                    <Field label="% sobre el exceso" required error={e.pct}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step={0.01}
                        value={f.pct}
                        onChange={(ev) => cambiarCampo(f.clave, "pct", ev.target.value)}
                        disabled={pendiente}
                        required
                      />
                    </Field>
                    <Field label="Sobre el exceso de (C$)" required error={e.exceso}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={f.exceso}
                        onChange={(ev) => cambiarCampo(f.clave, "exceso", ev.target.value)}
                        disabled={pendiente}
                        required
                      />
                    </Field>
                  </div>
                  {filas.length > 1 ? (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => quitar(f.clave)}
                        disabled={pendiente}
                        aria-label={`Quitar el tramo ${i + 1}`}
                      >
                        Quitar tramo
                      </Button>
                    </div>
                  ) : null}
                </fieldset>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={agregar}
            disabled={pendiente || alTope}
            aria-describedby={alTope ? `${id}-tope` : undefined}
            icon={<NexoIcon name="plus" />}
          >
            Agregar tramo
          </Button>
          {alTope ? (
            <p id={`${id}-tope`} className="text-xs text-neutral-500">
              Hasta {MAX_TRAMOS} tramos.
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pendiente}>
          Revisar y guardar
        </Button>
      </div>

      <ConfirmDialog
        open={confirmando}
        title="Guardar nueva tabla de IR"
        description={`Rige desde el ${fechaCorta(vigenteDesde)}.${
          efecto?.cierra ? ` La tabla del ${fechaCorta(efecto.cierra)} se cierra el ${fechaCorta(sumarDias(vigenteDesde, -1))}.` : ""
        } Las planillas ya aprobadas conservan la tabla con que se calcularon.`}
        confirmLabel="Guardar nueva tabla de IR"
        pending={pendiente}
        onConfirm={guardar}
        onCancel={cancelar}
      >
        {contenidoDialogo}
      </ConfirmDialog>
    </form>
  );
}
