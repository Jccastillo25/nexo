"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, FilterBar, Input, Select } from "@nexo/ui";
import { ESTADO_NOVEDAD } from "@/lib/planilla/estados";
import { ORIGEN_NOVEDAD } from "@/lib/planilla/etiquetas";
import { esFechaIso } from "@/lib/planilla/periodos";
import { RUTA } from "@/lib/planilla/rutas";
import type { EstadoNovedad, OrigenNovedad } from "@/lib/planilla/tipos";

/** Días de calendario entre dos fechas "YYYY-MM-DD" (para el tope de un año de la consulta). */
function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

export interface FiltrosNovedadesProps {
  desde: string;
  hasta: string;
  contrato: string | null;
  estado: EstadoNovedad | null;
  origen: OrigenNovedad | null;
  /** Personas para el filtro; null = no se pudieron cargar o el rol no las ve (el filtro no aparece). */
  contratos: { id: string; etiqueta: string }[] | null;
}

/**
 * Filtros de Novedades en la URL (`?desde=&hasta=&contrato=&estado=&origen=`).
 * "Consultar" valida el rango (desde ≤ hasta, hasta un año, como la RPC) con
 * el error junto al campo; "Limpiar" vuelve al mes actual.
 */
export function FiltrosNovedades(props: FiltrosNovedadesProps) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [desde, setDesde] = useState(props.desde);
  const [hasta, setHasta] = useState(props.hasta);
  const [contrato, setContrato] = useState(props.contrato ?? "");
  const [estado, setEstado] = useState<string>(props.estado ?? "");
  const [origen, setOrigen] = useState<string>(props.origen ?? "");
  const [errores, setErrores] = useState<{ desde?: string; hasta?: string }>({});

  function consultar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nuevos: typeof errores = {};
    if (!esFechaIso(desde)) nuevos.desde = "Indica la fecha de inicio.";
    if (!esFechaIso(hasta)) nuevos.hasta = "Indica la fecha de fin.";
    else if (esFechaIso(desde) && hasta < desde) nuevos.hasta = "«Hasta» no puede ser anterior a «Desde».";
    else if (esFechaIso(desde) && diasEntre(desde, hasta) > 366) nuevos.hasta = "Consulta un rango de hasta un año.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    startTransition(() => {
      router.push(
        RUTA.novedades({
          desde,
          hasta,
          contrato: contrato || undefined,
          estado: estado || undefined,
          origen: origen || undefined,
        })
      );
    });
  }

  function limpiar() {
    setErrores({});
    startTransition(() => router.push(RUTA.novedades()));
  }

  return (
    <FilterBar>
      <form onSubmit={consultar} noValidate aria-label="Filtros de novedades" aria-busy={pendiente} className="contents">
        <Field label="Desde" required error={errores.desde} className="w-40">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
        </Field>
        <Field label="Hasta" required error={errores.hasta} className="w-40">
          <Input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} required />
        </Field>
        {props.contratos ? (
          <Field label="Persona" className="w-64">
            <Select value={contrato} onChange={(e) => setContrato(e.target.value)}>
              <option value="">Todas</option>
              {props.contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.etiqueta}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Estado" className="w-40">
          <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {(Object.keys(ESTADO_NOVEDAD) as EstadoNovedad[]).map((k) => (
              <option key={k} value={k}>
                {ESTADO_NOVEDAD[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Origen" className="w-40">
          <Select value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value="">Todos</option>
            {(Object.keys(ORIGEN_NOVEDAD) as OrigenNovedad[]).map((k) => (
              <option key={k} value={k}>
                {ORIGEN_NOVEDAD[k]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary" loading={pendiente}>
            Consultar
          </Button>
          <Button variant="ghost" onClick={limpiar} disabled={pendiente}>
            Limpiar
          </Button>
        </div>
      </form>
    </FilterBar>
  );
}
