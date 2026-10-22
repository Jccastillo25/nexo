"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink, Field, Select } from "@nexo/ui";
import { ESTADO_PLANILLA } from "@/lib/planilla/estados";
import { etiquetaMes } from "@/lib/planilla/periodos";
import { RUTA } from "@/lib/planilla/rutas";
import type { EstadoPlanilla } from "@/lib/planilla/tipos";

export interface FiltrosPlanillasProps {
  estado: EstadoPlanilla | null;
  /** uuid del tipo (solo si el rol ve los tipos). */
  tipo: string | null;
  mes: string | null;
  /** Tipos para el filtro; null = el rol no tiene conceptos.ver y el filtro no aparece. */
  tipos: { id: string; nombre: string }[] | null;
}

/**
 * Filtros de la lista de planillas, en la URL (`?estado=&tipo=&mes=`).
 * Cambiar un filtro vuelve a la primera página. useOptimistic muestra la
 * opción elegida mientras carga y vuelve a la de la URL al terminar.
 */
export function FiltrosPlanillas({ estado, tipo, mes, tipos }: FiltrosPlanillasProps) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [valores, setValores] = useOptimistic({ estado: estado ?? "", tipo: tipo ?? "" });

  function ir(cambio: Partial<{ estado: string; tipo: string }>) {
    const siguiente = { ...valores, ...cambio };
    startTransition(() => {
      setValores(siguiente);
      router.push(
        RUTA.periodos({ estado: siguiente.estado || undefined, tipo: siguiente.tipo || undefined, mes: mes ?? undefined })
      );
    });
  }

  const hayFiltros = Boolean(estado || tipo || mes);

  return (
    <div className="flex w-full flex-wrap items-end gap-3" aria-busy={pendiente}>
      <Field label="Estado" className="w-44">
        <Select value={valores.estado} onChange={(e) => ir({ estado: e.target.value })}>
          <option value="">Todos</option>
          {(Object.keys(ESTADO_PLANILLA) as EstadoPlanilla[]).map((clave) => (
            <option key={clave} value={clave}>
              {ESTADO_PLANILLA[clave].label}
            </option>
          ))}
        </Select>
      </Field>
      {tipos ? (
        <Field label="Tipo de planilla" className="w-56">
          <Select value={valores.tipo} onChange={(e) => ir({ tipo: e.target.value })}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {mes ? (
        <span className="mb-1 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700">
          Mes: {etiquetaMes(mes)}
          <ButtonLink
            href={RUTA.periodos({ estado: estado ?? undefined, tipo: tipo ?? undefined })}
            variant="link"
            className="text-xs"
            aria-label={`Quitar el filtro de mes ${etiquetaMes(mes)}`}
          >
            Quitar
          </ButtonLink>
        </span>
      ) : null}
      {hayFiltros ? (
        <ButtonLink href={RUTA.periodos()} variant="link" className="mb-2">
          Quitar filtros
        </ButtonLink>
      ) : null}
      {pendiente ? (
        <span role="status" className="mb-2 text-xs text-neutral-500">
          Cargando…
        </span>
      ) : null}
    </div>
  );
}
