"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Field, Select, Spinner } from "@nexo/ui";
import { capitalizar, MESES } from "@/lib/metas/periodo";

/**
 * Año (y mes) de la pantalla, reflejados en la URL. `extra` conserva otros
 * parámetros (p. ej. la vista del dashboard). Cambiar el periodo vuelve a la
 * primera página.
 */
export function SelectorPeriodo({
  anio,
  mes,
  anios,
  extra = {},
  conMes = true,
}: {
  anio: number;
  mes?: number;
  anios: number[];
  extra?: Record<string, string>;
  conMes?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function ir(nuevoAnio: number, nuevoMes: number | undefined) {
    const sp = new URLSearchParams(extra);
    sp.set("anio", String(nuevoAnio));
    if (conMes && nuevoMes) sp.set("mes", String(nuevoMes));
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-2" aria-busy={isPending}>
      {conMes ? (
        <Field label="Mes" className="w-40">
          <Select value={mes} onChange={(e) => ir(anio, Number(e.target.value))}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {capitalizar(m)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Año" className="w-28">
        <Select value={anio} onChange={(e) => ir(Number(e.target.value), mes)}>
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </Field>
      {isPending ? (
        <span role="status" className="flex items-center gap-1.5 pb-2.5 text-xs text-neutral-500">
          <Spinner className="size-3.5" />
          Cargando…
        </span>
      ) : null}
    </div>
  );
}
