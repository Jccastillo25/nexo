"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, StatusBadge, useToast } from "@nexo/ui";
import { etiquetaVendedor, leerNumero, pct, usd } from "@/lib/metas/formato";
import type { MetaVendedorMes } from "@/lib/metas/tipos";
import { claseTarjeta, claseThead } from "@/components/metas/estilos";
import { ajustarMeta } from "./actions";

/**
 * Tabla de metas del mes: cada fila se guarda por separado (presupuesto_ajustar_meta).
 * Tabla editable: se queda como <table> (no DataTable); campos y botones son del kit.
 */
export function TablaMetas({
  anio,
  mes,
  ventana,
  vendedores,
}: {
  anio: number;
  mes: number;
  ventana: string;
  vendedores: MetaVendedorMes[];
}) {
  return (
    <section className={claseTarjeta} aria-labelledby="tabla-metas">
      <h2 id="tabla-metas" className="px-5 py-4 text-sm font-semibold text-neutral-900">
        Vendedores
      </h2>
      <div className="overflow-x-auto border-t border-neutral-200">
        <table className="w-full text-sm">
          <thead className={claseThead}>
            <tr>
              <th scope="col" className="px-4 py-2.5">Vendedor</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right md:table-cell">Base ({ventana})</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right md:table-cell">Peso</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right sm:table-cell">Sugerida</th>
              <th scope="col" className="px-4 py-2.5">Meta (US$)</th>
              <th scope="col" className="hidden px-4 py-2.5 sm:table-cell">Origen</th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {vendedores.map((v) => (
              // La clave incluye la meta guardada: al refrescar, la fila vuelve al valor de la base.
              <FilaMeta key={`${v.id}-${v.meta_usd ?? "x"}-${v.meta_origen ?? "x"}`} anio={anio} mes={mes} v={v} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilaMeta({ anio, mes, v }: { anio: number; mes: number; v: MetaVendedorMes }) {
  const router = useRouter();
  const { show } = useToast();
  const [valor, setValor] = useState(v.meta_usd === null ? "" : String(v.meta_usd));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const monto = leerNumero(valor);
  const valido = monto !== null && monto >= 0;
  const cambio = valido && (v.meta_usd === null || Math.abs(monto - Number(v.meta_usd)) >= 0.005);
  const idInput = `meta-${v.id}`;
  const sinVentas = v.activo && v.sugerida_usd !== null && Number(v.sugerida_usd) === 0;

  function guardar() {
    if (monto === null || monto < 0) {
      setError("Escribe un monto en US$ igual o mayor que 0.");
      return;
    }
    const m = monto;
    setError(null);
    startTransition(async () => {
      const res = await ajustarMeta(v.id, anio, mes, m);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar la meta.");
        return;
      }
      show(`Meta de ${v.nombre} guardada.`, "success");
      router.refresh();
    });
  }

  return (
    <tr className="align-top">
      <td className="px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-medium text-neutral-900">{etiquetaVendedor(v.codigo, v.nombre)}</span>
          {!v.activo ? <StatusBadge label="Inactivo" tone="neutral" /> : null}
        </div>
        {sinVentas ? (
          <p className="mt-1 text-xs text-amber-700">Sin ventas en los 3 meses anteriores: ajusta su meta a mano.</p>
        ) : null}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums md:table-cell">{usd(v.base_usd)}</td>
      <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums md:table-cell">{pct(v.peso)}</td>
      <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:table-cell">{usd(v.sugerida_usd)}</td>
      <td className="px-4 py-2.5">
        <label htmlFor={idInput} className="sr-only">
          Meta de {v.nombre}
        </label>
        <div className="w-36">
          <Input
            id={idInput}
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cambio) guardar();
            }}
            disabled={isPending}
            placeholder="Sin meta"
            invalid={!!error || (valor !== "" && !valido)}
            aria-describedby={error ? `${idInput}-error` : undefined}
            className="text-right tabular-nums"
          />
        </div>
        {error ? (
          <p id={`${idInput}-error`} role="alert" className="mt-1 max-w-[12rem] text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </td>
      <td className="hidden px-4 py-2.5 sm:table-cell">
        {v.meta_origen === "ajustada" ? (
          <StatusBadge label="Ajustada" tone="info" />
        ) : v.meta_origen === "sugerida" ? (
          <StatusBadge label="Sugerida" tone="neutral" />
        ) : (
          <StatusBadge label="Sin meta" tone="warning" />
        )}
      </td>
      <td className="px-4 py-2.5">
        <Button variant="secondary" onClick={guardar} disabled={!cambio} loading={isPending}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </td>
    </tr>
  );
}
