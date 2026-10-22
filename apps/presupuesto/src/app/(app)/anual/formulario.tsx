"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ConfirmDialog, Field, FormSection, Input, useToast } from "@nexo/ui";
import { leerNumero, usd } from "@/lib/metas/formato";
import { capitalizar, MESES } from "@/lib/metas/periodo";
import type { Presupuesto } from "@/lib/metas/tipos";
import { claseThead } from "@/components/metas/estilos";
import { guardarPresupuesto } from "./actions";

const redondear2 = (n: number) => Math.round(n * 100) / 100;
/** Fracción → texto en % para el input (0.0896 → "8.96"). */
const aTextoPct = (fraccion: number) => String(Math.round(Number(fraccion) * 100 * 10000) / 10000);
const PAREJO = String(Math.round((100 / 12) * 10000) / 10000);

export function FormularioPresupuesto({
  anio,
  datos,
  puedeEditar,
}: {
  anio: number;
  datos: Presupuesto;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();
  const sugeridoBase = Number(datos.sugerido.venta_base_usd) || 0;
  const repartoAnterior = (datos.sugerido.porcentajes ?? []).map(aTextoPct);

  const [base, setBase] = useState(() =>
    datos.existe && datos.venta_base_usd !== null ? String(datos.venta_base_usd) : sugeridoBase > 0 ? String(sugeridoBase) : ""
  );
  const [crecimiento, setCrecimiento] = useState(() =>
    datos.existe && datos.crecimiento !== null ? aTextoPct(datos.crecimiento) : ""
  );
  const [porcentajes, setPorcentajes] = useState<string[]>(() => {
    if (datos.existe && datos.meses.length === 12) return datos.meses.map((m) => aTextoPct(m.porcentaje));
    return repartoAnterior.length === 12 ? repartoAnterior : Array(12).fill("");
  });
  const [errores, setErrores] = useState<{ base?: string; crecimiento?: string; meses?: string; general?: string }>({});
  const [confirmar, setConfirmar] = useState(false);

  const baseNum = leerNumero(base);
  const crecNum = leerNumero(crecimiento);
  const pcts = porcentajes.map((p) => leerNumero(p));
  const total = baseNum !== null && crecNum !== null ? redondear2(baseNum * (1 + crecNum / 100)) : null;
  const suma = pcts.reduce<number>((a, p) => a + (p ?? 0), 0);
  const sumaOk = Math.abs(suma - 100) <= 0.05;
  const soloLectura = !puedeEditar;

  function validar() {
    const e: typeof errores = {};
    if (baseNum === null || baseNum < 0) e.base = "Escribe la venta base en US$ (un monto igual o mayor que 0).";
    if (crecNum === null || crecNum <= -100 || crecNum > 1000) e.crecimiento = "Escribe el crecimiento en %, entre -100 y 1000 (por ejemplo 32).";
    if (pcts.some((p) => p === null)) e.meses = "Llena el porcentaje de los 12 meses.";
    else if (pcts.some((p) => (p as number) < 0 || (p as number) > 100)) e.meses = "Cada porcentaje mensual debe estar entre 0 y 100.";
    else if (!sumaOk) e.meses = `Los porcentajes suman ${suma.toFixed(2)} %; deben sumar 100 %.`;
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function pedirGuardar() {
    if (!validar()) return;
    if (datos.existe) setConfirmar(true);
    else guardar();
  }

  function guardar() {
    if (baseNum === null || crecNum === null || pcts.some((p) => p === null)) return;
    const b = baseNum;
    const c = crecNum / 100;
    const fr = pcts.map((p) => (p as number) / 100);
    startTransition(async () => {
      const res = await guardarPresupuesto(anio, b, c, fr);
      setConfirmar(false);
      if (!res.ok) {
        setErrores({ general: res.message ?? "No se pudo guardar el presupuesto." });
        return;
      }
      show(`Presupuesto de ${anio} guardado.`, "success");
      router.refresh();
    });
  }

  function cambiarMes(i: number, valor: string) {
    setPorcentajes((prev) => prev.map((p, j) => (j === i ? valor : p)));
  }

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Venta base y crecimiento" description="Total del año = venta base × (1 + crecimiento).">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Field
              label="Venta base (US$)"
              hint={`Sugerida: venta de ${anio - 1} sin anuladas (${usd(sugeridoBase)}).`}
              error={errores.base}
            >
              <Input
                type="text"
                inputMode="decimal"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                disabled={soloLectura || isPending}
                className="tabular-nums"
              />
            </Field>
            {!soloLectura ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBase(String(sugeridoBase))}
                disabled={isPending || sugeridoBase <= 0}
                className="self-start"
              >
                Usar venta de {anio - 1}
              </Button>
            ) : null}
          </div>
          <Field label="Crecimiento (%)" hint="Hasta 2 decimales, por ejemplo 32 o 12.5." error={errores.crecimiento}>
            <Input
              type="text"
              inputMode="decimal"
              value={crecimiento}
              onChange={(e) => {
                // Hasta 2 decimales: lo que se ve es lo que guarda la base (numeric(7,4) como fracción).
                const v = e.target.value.trim();
                if (/^-?\d*(\.\d*)?$/.test(v)) setCrecimiento(v.replace(/^(-?\d*\.\d{2})\d+$/, "$1"));
              }}
              disabled={soloLectura || isPending}
              placeholder="32"
              className="tabular-nums"
            />
          </Field>
          <div className="flex flex-col">
            <span className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700" id="p-total-label">
              Total del año
            </span>
            <output aria-labelledby="p-total-label" aria-live="polite" className="py-2 text-2xl font-semibold tabular-nums text-neutral-900">
              {total === null ? "—" : usd(total)}
            </output>
          </div>
        </div>
      </FormSection>

      <FormSection title="Reparto por mes" description="Qué parte del total corresponde a cada mes. La suma debe dar 100 %.">
        {!soloLectura ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setPorcentajes(repartoAnterior)}
              disabled={isPending || repartoAnterior.length !== 12 || sugeridoBase <= 0}
            >
              Usar reparto de {anio - 1}
            </Button>
            <Button variant="secondary" onClick={() => setPorcentajes(Array(12).fill(PAREJO))} disabled={isPending}>
              Repartir parejo (8.33 %)
            </Button>
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className={claseThead}>
              <tr>
                <th scope="col" className="px-3 py-2">Mes</th>
                <th scope="col" className="px-3 py-2">%</th>
                <th scope="col" className="px-3 py-2 text-right">Monto (US$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {MESES.map((m, i) => {
                const p = pcts[i];
                return (
                  <tr key={m}>
                    <th scope="row" className="px-3 py-1.5 text-left font-normal">{capitalizar(m)}</th>
                    <td className="px-3 py-1.5">
                      <label htmlFor={`p-mes-${i}`} className="sr-only">Porcentaje de {m}</label>
                      <div className="w-28">
                        <Input
                          id={`p-mes-${i}`}
                          type="text"
                          inputMode="decimal"
                          value={porcentajes[i]}
                          onChange={(e) => cambiarMes(i, e.target.value)}
                          disabled={soloLectura || isPending}
                          invalid={porcentajes[i] !== "" && (p === null || p < 0 || p > 100)}
                          aria-describedby={errores.meses ? "p-meses-error" : undefined}
                          className="text-right tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      {total !== null && p !== null ? usd(redondear2(total * (p / 100))) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-neutral-200">
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-semibold">Suma</th>
                <td className="px-3 py-2" aria-live="polite">
                  <span className={`font-semibold tabular-nums ${sumaOk ? "text-emerald-700" : "text-red-700"}`}>
                    {suma.toFixed(2)} %
                  </span>
                  <span className="ml-2 text-xs text-neutral-500">{sumaOk ? "Cuadra" : "Debe sumar 100 %"}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                  {total === null ? "—" : usd(pcts.reduce<number>((a, p) => a + (p === null ? 0 : redondear2(total * (p / 100))), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {errores.meses ? (
          <p id="p-meses-error" role="alert" className="text-sm text-red-700">
            {errores.meses}
          </p>
        ) : null}
      </FormSection>

      {!soloLectura ? (
        <div className="flex flex-col gap-2">
          {errores.general ? <Alert tone="error">{errores.general}</Alert> : null}
          <div>
            <Button onClick={pedirGuardar} loading={isPending}>
              {isPending ? "Guardando…" : `Guardar presupuesto de ${anio}`}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmar}
        title={`Actualizar el presupuesto de ${anio}`}
        description="Cambian la meta de la empresa de cada mes. Las metas por vendedor ya generadas no cambian: vuelve a generarlas en Metas por vendedor si hace falta."
        confirmLabel="Guardar cambios"
        pending={isPending}
        onConfirm={guardar}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  );
}
