"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink, Field, Select } from "@nexo/ui";
import { TIPO_CONCEPTO } from "@/lib/planilla/etiquetas";
import { RUTA } from "@/lib/planilla/rutas";
import type { TipoConcepto } from "@/lib/planilla/tipos";

interface Filtros {
  tipo: TipoConcepto | "";
  estado: "activo" | "inactivo" | "";
}

/**
 * Filtros del catálogo de conceptos en la URL (`?tipo=`, `?estado=activo|inactivo`).
 * useOptimistic muestra la opción elegida mientras carga.
 */
export function FiltrosConceptos({ tipo, estado }: Filtros) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [valor, setValor] = useOptimistic<Filtros>({ tipo, estado });

  function ir(nuevo: Filtros) {
    startTransition(() => {
      setValor(nuevo);
      router.push(RUTA.conceptos({ tipo: nuevo.tipo || undefined, estado: nuevo.estado || undefined }));
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pendiente}>
      <Field label="Tipo" className="w-48">
        <Select
          value={valor.tipo}
          onChange={(e) => {
            const v = e.target.value;
            ir({ ...valor, tipo: Object.hasOwn(TIPO_CONCEPTO, v) ? (v as TipoConcepto) : "" });
          }}
        >
          <option value="">Todos</option>
          {(Object.keys(TIPO_CONCEPTO) as TipoConcepto[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_CONCEPTO[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Estado" className="w-40">
        <Select
          value={valor.estado}
          onChange={(e) => {
            const v = e.target.value;
            ir({ ...valor, estado: v === "activo" || v === "inactivo" ? v : "" });
          }}
        >
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </Select>
      </Field>
      {tipo || estado ? (
        <ButtonLink href={RUTA.conceptos()} variant="link" className="pb-2">
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
