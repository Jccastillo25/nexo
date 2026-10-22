"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink, Field, Select } from "@nexo/ui";
import { ESTADO_CONTRATO, type EstadoContrato } from "@/lib/contratos";

const RUTA = "/contratacion/contratos";

/**
 * Filtro por estado del listado de contratos. El estado vive en la URL
 * (`?estado=borrador|activo|finalizado`), así los KPI del Dashboard enlazan
 * directo a la lista filtrada. useOptimistic muestra la opción elegida
 * mientras carga y vuelve a la de la URL al terminar (también con Atrás).
 */
export function FiltroEstadoContratos({ estado }: { estado: EstadoContrato | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [valor, setValor] = useOptimistic<string>(estado ?? "");

  function cambiar(nuevo: string) {
    startTransition(() => {
      setValor(nuevo);
      router.push(nuevo ? `${RUTA}?estado=${nuevo}` : RUTA);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={isPending}>
      <Field label="Estado" className="w-48">
        <Select value={valor} onChange={(e) => cambiar(e.target.value)}>
          <option value="">Todos</option>
          {(Object.keys(ESTADO_CONTRATO) as EstadoContrato[]).map((clave) => (
            <option key={clave} value={clave}>
              {ESTADO_CONTRATO[clave].label}
            </option>
          ))}
        </Select>
      </Field>
      {estado ? (
        <ButtonLink href={RUTA} variant="link" className="pb-2">
          Quitar filtro
        </ButtonLink>
      ) : null}
      {isPending ? (
        <span role="status" className="pb-2 text-xs text-neutral-500">
          Cargando…
        </span>
      ) : null}
    </div>
  );
}
