"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Field, Select, Spinner } from "@nexo/ui";
import { MESES, nombreMes, partesMes } from "@/lib/planilla/periodos";

/**
 * Mes y año de la pantalla, reflejados en la URL (`?mes=YYYY-MM` por
 * defecto). Conserva los demás parámetros y quita los de `reiniciar` (por
 * defecto `pagina`, para volver a la primera página). Mismo patrón que
 * SelectorPeriodo de Presupuesto (deuda D24: generalizarlo a @nexo/ui).
 *
 * Los parámetros actuales se leen al cambiar (window.location), no con
 * useSearchParams: así no exige un límite de Suspense.
 */
export function SelectorMes({
  mes,
  anios,
  param = "mes",
  reiniciar = ["pagina"],
  label = "Período",
}: {
  /** Mes elegido "YYYY-MM" (ya validado por la página con `leerMes`). */
  mes: string;
  /** Años del selector; por defecto, 4 antes y 1 después del elegido. */
  anios?: readonly number[];
  /** Nombre del parámetro de la URL. */
  param?: string;
  /** Parámetros que se quitan al cambiar de mes. */
  reiniciar?: readonly string[];
  /** Nombre accesible del grupo (p. ej. "Mes de las declaraciones"). */
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, startTransition] = useTransition();
  const { anio, mes: numeroMes } = partesMes(mes);
  const opcionesAnio = anios && anios.length > 0 ? [...anios] : Array.from({ length: 6 }, (_, i) => anio - 4 + i);
  if (!opcionesAnio.includes(anio)) opcionesAnio.push(anio);
  opcionesAnio.sort((a, b) => a - b);

  function ir(nuevoAnio: number, nuevoMes: number) {
    const sp = new URLSearchParams(window.location.search);
    for (const clave of reiniciar) sp.delete(clave);
    sp.set(param, `${nuevoAnio}-${String(nuevoMes).padStart(2, "0")}`);
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <div role="group" aria-label={label} aria-busy={pendiente} className="flex flex-wrap items-end gap-2">
      <Field label="Mes" className="w-40">
        <Select value={numeroMes} onChange={(e) => ir(anio, Number(e.target.value))}>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {nombreMes(i + 1, true)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Año" className="w-28">
        <Select value={anio} onChange={(e) => ir(Number(e.target.value), numeroMes)}>
          {opcionesAnio.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </Field>
      {pendiente ? (
        <span role="status" className="flex items-center gap-1.5 pb-2.5 text-xs text-neutral-500">
          <Spinner className="size-3.5" />
          Cargando…
        </span>
      ) : null}
    </div>
  );
}
