"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, FormSection, Input, NexoIcon, Select, fechaCorta, useToast } from "@nexo/ui";
import { FRECUENCIA } from "@/lib/planilla/etiquetas";
import {
  MESES,
  esFechaIso,
  etiquetaPeriodo,
  nombreMes,
  partesMes,
  periodoAnual,
  periodoMes,
  periodoQuincena,
  periodoSemana,
  type Periodo,
  type Quincena,
} from "@/lib/planilla/periodos";
import { RUTA } from "@/lib/planilla/rutas";
import type { ClasePlanilla, Frecuencia } from "@/lib/planilla/tipos";
import { crearPlanilla } from "../actions";

export interface TipoOpcion {
  id: string;
  nombre: string;
  clase: ClasePlanilla;
  frecuencia: Frecuencia;
  /** Período propuesto: el siguiente a la última planilla no anulada del tipo, o el que contiene hoy. */
  propuesto: Periodo;
}

interface Campos {
  anio: number;
  mes: number;
  quincena: Quincena;
  inicioSemana: string;
}

function camposDe(p: Periodo, frecuencia: Frecuencia): Campos {
  const base = frecuencia === "anual" ? partesMes(p.fin) : partesMes(p.inicio);
  return {
    anio: base.anio,
    mes: base.mes,
    quincena: Number(p.inicio.slice(8, 10)) <= 15 ? 1 : 2,
    inicioSemana: p.inicio,
  };
}

/** Período que resulta de los campos: por construcción, siempre válido para la frecuencia. */
function periodoDe(frecuencia: Frecuencia, c: Campos): Periodo | null {
  switch (frecuencia) {
    case "quincenal":
      return periodoQuincena(c.anio, c.mes, c.quincena);
    case "mensual":
      return periodoMes(c.anio, c.mes);
    case "semanal":
      return esFechaIso(c.inicioSemana) ? periodoSemana(c.inicioSemana) : null;
    case "anual":
      return periodoAnual(c.anio);
  }
}

/**
 * Formulario "Nueva planilla" (B3). Los campos del período cambian con la
 * frecuencia del tipo (quincena, mes, semana de 7 días o año del
 * aguinaldo), así el cliente solo puede enviar períodos válidos; la RPC
 * vuelve a validarlos. Un error de la RPC se muestra arriba sin perder lo
 * escrito.
 */
export function NuevaPlanillaForm({
  tipos,
  hoy,
  reemplazo,
}: {
  tipos: TipoOpcion[];
  hoy: string;
  /** Modo reemplazo: tipo y período bloqueados. */
  reemplazo: { id: string; tipoId: string; periodo: Periodo } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, startTransition] = useTransition();
  const idResumen = useId();

  const inicial = (reemplazo ? tipos.find((t) => t.id === reemplazo.tipoId) : undefined) ?? tipos[0];
  const [tipoId, setTipoId] = useState(inicial?.id ?? "");
  const [campos, setCampos] = useState<Campos>(() =>
    inicial ? camposDe(reemplazo ? reemplazo.periodo : inicial.propuesto, inicial.frecuencia) : camposDe({ inicio: hoy, fin: hoy }, "mensual")
  );
  const [fechaPago, setFechaPago] = useState("");
  const [errores, setErrores] = useState<{ tipo?: string; semana?: string; fechaPago?: string }>({});
  const [error, setError] = useState<string | null>(null);

  const tipo = tipos.find((t) => t.id === tipoId) ?? null;
  const periodo = reemplazo ? reemplazo.periodo : tipo ? periodoDe(tipo.frecuencia, campos) : null;
  const anioHoy = Number(hoy.slice(0, 4));
  const anios = Array.from(new Set([anioHoy - 3, anioHoy - 2, anioHoy - 1, anioHoy, anioHoy + 1, campos.anio])).sort((a, b) => a - b);
  const esAguinaldo = tipo?.clase === "aguinaldo" || tipo?.frecuencia === "anual";

  function cambiarTipo(id: string) {
    setTipoId(id);
    setErrores({});
    const nuevo = tipos.find((t) => t.id === id);
    if (nuevo) setCampos(camposDe(nuevo.propuesto, nuevo.frecuencia));
  }

  function cambiar(cambio: Partial<Campos>) {
    setCampos((c) => ({ ...c, ...cambio }));
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (!tipo) nuevos.tipo = "Elige el tipo de planilla.";
    if (tipo?.frecuencia === "semanal" && !esFechaIso(campos.inicioSemana)) nuevos.semana = "Indica la fecha de inicio de la semana.";
    if (fechaPago && !esFechaIso(fechaPago)) nuevos.fechaPago = "La fecha de pago no es válida.";
    else if (fechaPago && periodo && fechaPago < periodo.inicio) {
      nuevos.fechaPago = `La fecha de pago no puede ser anterior al ${fechaCorta(periodo.inicio)}.`;
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0 || !tipo || !periodo) return;

    setError(null);
    startTransition(async () => {
      const r = await crearPlanilla({
        tipoId: tipo.id,
        inicio: periodo.inicio,
        fin: periodo.fin,
        fechaPago: fechaPago || null,
        reemplazaA: reemplazo?.id ?? null,
      });
      if (!r.ok) {
        setError(r.message);
        toast.show(r.message, "error");
        return;
      }
      toast.show("Planilla creada en borrador. Revisa las novedades del período y calcúlala.", "success");
      router.push(RUTA.detalle(r.data));
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="flex max-w-3xl flex-col gap-6" aria-describedby={idResumen}>
      {error ? (
        <Alert tone="error" title="No se pudo crear la planilla">
          {error}
        </Alert>
      ) : null}

      <FormSection title="Tipo y período" description="El período depende de la frecuencia del tipo de planilla.">
        <fieldset disabled={pendiente} className="flex flex-col gap-4">
          <Field label="Tipo de planilla" required error={errores.tipo} hint={reemplazo ? "Igual al de la planilla anulada." : undefined}>
            <Select value={tipoId} onChange={(e) => cambiarTipo(e.target.value)} disabled={reemplazo !== null} required>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} ({FRECUENCIA[t.frecuencia]})
                </option>
              ))}
            </Select>
          </Field>

          {reemplazo || !tipo ? null : tipo.frecuencia === "semanal" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Fecha de inicio" required error={errores.semana}>
                <Input
                  type="date"
                  value={campos.inicioSemana}
                  onChange={(e) => cambiar({ inicioSemana: e.target.value })}
                  required
                />
              </Field>
              <Field label="Fecha de fin" hint="Siete días desde el inicio.">
                <Input type="text" value={periodo ? fechaCorta(periodo.fin) : "—"} readOnly aria-readonly="true" />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tipo.frecuencia === "anual" ? null : (
                <Field label="Mes" required>
                  <Select value={campos.mes} onChange={(e) => cambiar({ mes: Number(e.target.value) })} required>
                    {MESES.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {nombreMes(i + 1, true)}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Año" required>
                <Select value={campos.anio} onChange={(e) => cambiar({ anio: Number(e.target.value) })} required>
                  {anios.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </Field>
              {tipo.frecuencia === "quincenal" ? (
                <fieldset className="flex flex-col gap-2 sm:col-span-2">
                  <legend className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700">
                    Quincena
                    <span aria-hidden="true" className="ml-0.5 text-red-600">
                      *
                    </span>
                  </legend>
                  {([1, 2] as const).map((q) => (
                    <label key={q} className="flex items-center gap-2 text-sm text-neutral-800">
                      <input
                        type="radio"
                        name="quincena"
                        value={q}
                        checked={campos.quincena === q}
                        onChange={() => cambiar({ quincena: q })}
                        className="size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      />
                      {q === 1 ? "1.ª quincena (del 1 al 15)" : "2.ª quincena (del 16 al último día)"}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {tipo.frecuencia === "anual" ? (
                <p className="text-sm text-neutral-600 sm:col-span-2">Del 1 de enero al 31 de diciembre de {campos.anio}.</p>
              ) : null}
            </div>
          )}

          <Field
            label="Fecha de pago"
            optional
            error={errores.fechaPago}
            hint={esAguinaldo ? "El Código del Trabajo pide pagarlo en los primeros 10 días de diciembre." : undefined}
          >
            <Input type="date" value={fechaPago} min={periodo?.inicio} onChange={(e) => setFechaPago(e.target.value)} />
          </Field>
        </fieldset>

        {tipo?.frecuencia === "quincenal" && periodo && Number(periodo.inicio.slice(8, 10)) === 16 ? (
          <Alert tone="info">Para calcular el IR de la 2.ª quincena, la 1.ª quincena del mes debe estar aprobada.</Alert>
        ) : null}

        <p id={idResumen} role="status" className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          {periodo && tipo ? (
            <>
              <span className="font-medium text-neutral-900">Se creará:</span>{" "}
              {etiquetaPeriodo(periodo.inicio, periodo.fin, tipo.frecuencia, tipo.clase)} · del {fechaCorta(periodo.inicio)} al{" "}
              {fechaCorta(periodo.fin)}
            </>
          ) : (
            "Completa el tipo y el período."
          )}
        </p>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pendiente} icon={<NexoIcon name="plus" />}>
          {pendiente ? "Creando…" : "Crear planilla"}
        </Button>
      </div>
    </form>
  );
}
