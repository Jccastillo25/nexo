"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, StatusBadge, useToast } from "@nexo/ui";
import type { Clasificacion } from "@/lib/tipos";
import { guardarClasificacion } from "./actions";

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

type Nivel = Clasificacion["nivel"];
const HIJO: Record<Nivel, Nivel | null> = { clase: "tipo", tipo: "categoria", categoria: null };
const NOMBRE: Record<Nivel, string> = { clase: "clase", tipo: "tipo", categoria: "categoría" };

interface Borrador {
  id: string | null;
  nivel: Nivel;
  padreId: string | null;
  numero: string;
  nombre: string;
  activa: boolean;
  usado: boolean;
}

function siguiente(hermanos: Clasificacion[]): string {
  const usados = new Set(hermanos.map((h) => Number(h.numero)));
  let n = 1;
  while (usados.has(n)) n++;
  return String(n).padStart(2, "0");
}

export default function ArbolClasificacion({ clasificaciones, puedeGestionar }: { clasificaciones: Clasificacion[]; puedeGestionar: boolean }) {
  const router = useRouter();
  const { show } = useToast();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hijos = (padreId: string | null, nivel: Nivel) =>
    clasificaciones.filter((c) => c.nivel === nivel && c.padre_id === padreId).sort((a, b) => a.numero.localeCompare(b.numero));

  // Prefijo de código de cada nodo: números de los ancestros + el propio.
  const prefijo = (c: Clasificacion): string => {
    const padre = c.padre_id ? clasificaciones.find((x) => x.id === c.padre_id) : null;
    return (padre ? prefijo(padre) : "") + c.numero;
  };

  function nuevo(nivel: Nivel, padreId: string | null) {
    setError(null);
    setBorrador({ id: null, nivel, padreId, numero: siguiente(hijos(padreId, nivel)), nombre: "", activa: true, usado: false });
  }

  function editar(c: Clasificacion) {
    setError(null);
    setBorrador({ id: c.id, nivel: c.nivel, padreId: c.padre_id, numero: c.numero, nombre: c.nombre, activa: c.activa, usado: c.productos > 0 });
  }

  function guardar() {
    if (!borrador) return;
    if (!borrador.nombre.trim()) return setError("Escribe el nombre.");
    startTransition(async () => {
      const res = await guardarClasificacion(borrador);
      if (!res.ok) return setError(res.message ?? "No se pudo guardar.");
      show(borrador.id ? "Clasificación actualizada." : `${NOMBRE[borrador.nivel][0].toUpperCase()}${NOMBRE[borrador.nivel].slice(1)} creada.`, "success");
      setBorrador(null);
      router.refresh();
    });
  }

  const formulario = (b: Borrador) => (
    <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          Número
          <input
            className={`${inputClass} w-20 font-mono`}
            value={b.numero}
            maxLength={2}
            disabled={b.usado}
            inputMode="numeric"
            onChange={(e) => setBorrador({ ...b, numero: e.target.value.replace(/\D/g, "") })}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-neutral-600">
          Nombre
          <input className={`${inputClass} w-full`} value={b.nombre} maxLength={80} autoFocus onChange={(e) => setBorrador({ ...b, nombre: e.target.value })} />
        </label>
        {b.id && (
          <label className="flex items-center gap-2 pb-1.5 text-sm text-neutral-700">
            <input type="checkbox" checked={b.activa} onChange={(e) => setBorrador({ ...b, activa: e.target.checked })} />
            Activa
          </label>
        )}
      </div>
      {b.usado && <p className="text-xs text-neutral-500">El número está fijo porque ya hay productos con esta clasificación.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setBorrador(null)} className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Cancelar
        </button>
        <button type="button" onClick={guardar} disabled={isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          {isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );

  const nodo = (c: Clasificacion, profundidad: number): React.ReactNode => {
    const hijo = HIJO[c.nivel];
    const editando = borrador?.id === c.id;
    return (
      <li key={c.id} className="flex flex-col">
        <div
          className={`flex items-center gap-3 border-b border-neutral-100 py-2 pr-4 text-sm ${profundidad === 0 ? "bg-neutral-50 font-semibold" : ""}`}
          style={{ paddingLeft: 16 + profundidad * 24 }}
        >
          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-blue-700">{c.numero}</span>
          <span className={c.activa ? "text-neutral-900" : "text-neutral-400 line-through"}>{c.nombre}</span>
          {!c.activa && <StatusBadge label="Inactiva" tone="neutral" />}
          <span className="ml-auto hidden whitespace-nowrap text-xs text-neutral-400 sm:inline">
            {c.nivel === "categoria" ? `Código ${prefijo(c)}-` : c.codigo_erp ? `ERP: ${c.codigo_erp}` : ""}
            {c.productos > 0 ? ` · ${c.productos} prod.` : ""}
          </span>
          {puedeGestionar && (
            <button type="button" onClick={() => editar(c)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              Editar
            </button>
          )}
        </div>
        {editando && borrador && <div style={{ paddingLeft: 16 + profundidad * 24 }} className="py-2 pr-4">{formulario(borrador)}</div>}
        {hijo && (
          <ul>
            {hijos(c.id, hijo).map((h) => nodo(h, profundidad + 1))}
            {puedeGestionar && (
              <li style={{ paddingLeft: 16 + (profundidad + 1) * 24 }} className="border-b border-neutral-100 py-1.5 pr-4">
                {borrador && !borrador.id && borrador.padreId === c.id ? (
                  formulario(borrador)
                ) : (
                  <button type="button" onClick={() => nuevo(hijo, c.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                    + Agregar {NOMBRE[hijo]} (siguiente: {siguiente(hijos(c.id, hijo))})
                  </button>
                )}
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  const clases = hijos(null, "clase");

  return (
    <div className="flex flex-col gap-4">
      {!puedeGestionar && (
        <p className="rounded-md bg-neutral-200/60 px-3 py-2 text-sm text-neutral-700">Solo lectura: tu rol no permite gestionar la clasificación.</p>
      )}
      {clases.length === 0 && !borrador ? (
        <EmptyState
          title="Todavía no hay clasificación"
          description="Se crea sola al importar el Excel del ERP, o agrégala a mano."
          action={
            puedeGestionar ? (
              <button type="button" onClick={() => nuevo("clase", null)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Agregar la primera clase
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <ul>{clases.map((c) => nodo(c, 0))}</ul>
          {puedeGestionar && (
            <div className="px-4 py-3">
              {borrador && !borrador.id && borrador.nivel === "clase" ? (
                formulario(borrador)
              ) : (
                <button type="button" onClick={() => nuevo("clase", null)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  + Agregar clase (siguiente: {siguiente(clases)})
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-neutral-500">
        A la derecha de cada categoría está el inicio del código de sus productos nuevos (ej. <span className="font-mono">030202-</span> + consecutivo).
      </p>
    </div>
  );
}
