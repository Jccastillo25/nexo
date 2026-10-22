"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink, Field, Select } from "@nexo/ui";
import { REGIMEN } from "@/lib/planilla/etiquetas";
import { RUTA } from "@/lib/planilla/rutas";

export type FiltroRegimen = "laboral" | "servicios_profesionales" | "sin";

interface Filtros {
  aviso: boolean;
  regimen: FiltroRegimen | "";
  incluirFinalizados: boolean;
}

const CHECKBOX =
  "size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

/**
 * Filtros del listado de régimen por contrato, en la URL (`?aviso=1`,
 * `?regimen=laboral|servicios_profesionales|sin`, `?estado=todos`). Se
 * aplican en el servidor. useOptimistic muestra la opción elegida mientras
 * carga y vuelve a la de la URL al terminar (también con Atrás).
 */
export function FiltrosRegimen({ aviso, regimen, incluirFinalizados }: Filtros) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [valor, setValor] = useOptimistic<Filtros>({ aviso, regimen, incluirFinalizados });
  const hayFiltros = aviso || regimen !== "" || incluirFinalizados;

  function ir(nuevo: Filtros) {
    startTransition(() => {
      setValor(nuevo);
      router.push(
        RUTA.regimen({
          aviso: nuevo.aviso,
          regimen: nuevo.regimen || undefined,
          estado: nuevo.incluirFinalizados ? "todos" : undefined,
        })
      );
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-4" aria-busy={pendiente}>
      <Field label="Régimen" className="w-56">
        <Select
          value={valor.regimen}
          onChange={(e) => {
            const v = e.target.value;
            ir({ ...valor, regimen: v === "laboral" || v === "servicios_profesionales" || v === "sin" ? v : "" });
          }}
        >
          <option value="">Todos</option>
          <option value="laboral">{REGIMEN.laboral}</option>
          <option value="servicios_profesionales">{REGIMEN.servicios_profesionales}</option>
          <option value="sin">Sin régimen</option>
        </Select>
      </Field>
      <label className="flex h-9 items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          className={CHECKBOX}
          checked={valor.aviso}
          onChange={(e) => ir({ ...valor, aviso: e.target.checked })}
        />
        Solo con aviso
      </label>
      <label className="flex h-9 items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          className={CHECKBOX}
          checked={valor.incluirFinalizados}
          onChange={(e) => ir({ ...valor, incluirFinalizados: e.target.checked })}
        />
        Incluir finalizados
      </label>
      {hayFiltros ? (
        <ButtonLink href={RUTA.regimen()} variant="link" className="pb-2">
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
