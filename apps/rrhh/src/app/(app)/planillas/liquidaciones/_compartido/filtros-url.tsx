"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink, Field, Select } from "@nexo/ui";
import { conQuery } from "@/lib/planilla/rutas";

export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
}

export interface CampoFiltro {
  /** Parámetro de la URL (`estado`, `contrato`). */
  nombre: string;
  label: string;
  /** Valor aplicado (ya validado por la página); "" = sin filtro. */
  valor: string;
  /** Texto de la opción vacía ("Todos", "Todas las personas"). */
  todos: string;
  opciones: OpcionFiltro[];
  /** Clases de ancho del campo. */
  ancho?: string;
}

/**
 * Filtros de un listado del Paquete C con el estado en la URL (Atrás vuelve
 * al filtro anterior). Cada cambio navega con router.push y el Server
 * Component vuelve a consultar; useOptimistic muestra lo elegido mientras
 * carga. Mismo patrón que FiltroEstadoContratos. "Quitar filtros" vuelve a la
 * ruta base.
 */
export function FiltrosUrl({ ruta, campos, etiqueta }: { ruta: string; campos: CampoFiltro[]; etiqueta: string }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const inicial = Object.fromEntries(campos.map((c) => [c.nombre, c.valor])) as Record<string, string>;
  const [valores, setValores] = useOptimistic(inicial);
  const hayFiltros = campos.some((c) => c.valor !== "");

  function cambiar(nombre: string, valor: string) {
    const siguiente = { ...valores, [nombre]: valor };
    startTransition(() => {
      setValores(siguiente);
      router.push(conQuery(ruta, siguiente));
    });
  }

  return (
    <div role="group" aria-label={etiqueta} aria-busy={pendiente} className="flex w-full flex-wrap items-end gap-3">
      {campos.map((c) => (
        <Field key={c.nombre} label={c.label} className={c.ancho ?? "w-full sm:w-56"}>
          <Select value={valores[c.nombre] ?? ""} onChange={(e) => cambiar(c.nombre, e.target.value)}>
            <option value="">{c.todos}</option>
            {c.opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      ))}
      {hayFiltros ? (
        <ButtonLink href={ruta} variant="link" className="pb-2">
          Quitar filtros
        </ButtonLink>
      ) : null}
      {pendiente ? (
        <span role="status" className="pb-2 text-xs text-neutral-500">
          Cargando…
        </span>
      ) : null}
    </div>
  );
}
