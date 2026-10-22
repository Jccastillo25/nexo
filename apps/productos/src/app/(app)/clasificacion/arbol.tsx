"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, EmptyState, Field, Input, StatusBadge, useToast } from "@nexo/ui";
import type { Clasificacion } from "@/lib/tipos";
import { guardarClasificacion } from "./actions";

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
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
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
    setErrorNombre(null);
    setBorrador({ id: null, nivel, padreId, numero: siguiente(hijos(padreId, nivel)), nombre: "", activa: true, usado: false });
  }

  function editar(c: Clasificacion) {
    setError(null);
    setErrorNombre(null);
    setBorrador({ id: c.id, nivel: c.nivel, padreId: c.padre_id, numero: c.numero, nombre: c.nombre, activa: c.activa, usado: c.productos > 0 });
  }

  function guardar() {
    if (!borrador) return;
    setError(null);
    if (!borrador.nombre.trim()) return setErrorNombre("Escribe el nombre.");
    startTransition(async () => {
      const res = await guardarClasificacion(borrador);
      if (!res.ok) return setError(res.message ?? "No se pudo guardar.");
      show(borrador.id ? "Clasificación actualizada." : `${NOMBRE[borrador.nivel][0].toUpperCase()}${NOMBRE[borrador.nivel].slice(1)} creada.`, "success");
      setBorrador(null);
      router.refresh();
    });
  }

  const formulario = (b: Borrador) => (
    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <Field label="Número" className="w-20">
          <Input
            className="font-mono"
            value={b.numero}
            maxLength={2}
            disabled={b.usado}
            inputMode="numeric"
            onChange={(e) => setBorrador({ ...b, numero: e.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field label="Nombre" required error={errorNombre} className="min-w-48 flex-1">
          <Input
            value={b.nombre}
            maxLength={80}
            autoFocus
            onChange={(e) => {
              setErrorNombre(null);
              setBorrador({ ...b, nombre: e.target.value });
            }}
          />
        </Field>
        {b.id && (
          <label className="mt-[26px] flex h-9 items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={b.activa} onChange={(e) => setBorrador({ ...b, activa: e.target.checked })} />
            Activa
          </label>
        )}
      </div>
      {b.usado && <p className="text-xs text-neutral-500">El número está fijo porque ya hay productos con esta clasificación.</p>}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setBorrador(null)}>
          Cancelar
        </Button>
        <Button size="sm" onClick={guardar} loading={isPending}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
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
          <span className={c.activa ? "text-neutral-900" : "text-neutral-500 line-through"}>{c.nombre}</span>
          {!c.activa && <StatusBadge label="Inactiva" tone="neutral" />}
          <span className="ml-auto hidden whitespace-nowrap text-xs text-neutral-500 sm:inline">
            {c.nivel === "categoria" ? `Código ${prefijo(c)}-` : c.codigo_erp ? `ERP: ${c.codigo_erp}` : ""}
            {c.productos > 0 ? ` · ${c.productos} prod.` : ""}
          </span>
          {puedeGestionar && (
            <Button variant="link" className="ml-auto sm:ml-0" aria-label={`Editar ${c.nombre}`} onClick={() => editar(c)}>
              Editar
            </Button>
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
                  <Button variant="link" onClick={() => nuevo(hijo, c.id)}>
                    + Agregar {NOMBRE[hijo]} (siguiente: {siguiente(hijos(c.id, hijo))})
                  </Button>
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
      {!puedeGestionar && <Alert tone="info">Solo lectura: tu rol no permite gestionar la clasificación.</Alert>}
      {clases.length === 0 && !borrador ? (
        <EmptyState
          title="Todavía no hay clasificación"
          description="Se crea sola al importar el Excel del ERP, o agrégala a mano."
          action={puedeGestionar ? <Button onClick={() => nuevo("clase", null)}>Agregar la primera clase</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <ul>{clases.map((c) => nodo(c, 0))}</ul>
          {puedeGestionar && (
            <div className="px-4 py-3">
              {borrador && !borrador.id && borrador.nivel === "clase" ? (
                formulario(borrador)
              ) : (
                <Button variant="link" onClick={() => nuevo("clase", null)}>
                  + Agregar clase (siguiente: {siguiente(clases)})
                </Button>
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
