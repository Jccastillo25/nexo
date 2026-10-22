"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@nexo/ui";
import { etiquetaVendedor } from "@/lib/metas/formato";
import { guardarTablero } from "./actions";

interface Opcion {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  en_tablero: boolean;
}

/**
 * "Elegir vendedores" del cuadro de meta (pedido del usuario 2026-10-20). Solo
 * se muestra con presupuesto.metas.meta_vendedor.gestionar; la RPC lo vuelve a
 * exigir. La elección es de la empresa: todos los que ven el equipo ven el
 * mismo cuadro.
 */
export function ElegirVendedores({ vendedores }: { vendedores: Opcion[] }) {
  const router = useRouter();
  const { show } = useToast();
  const idPanel = useId();
  const [abierto, setAbierto] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(vendedores.filter((v) => v.en_tablero).map((v) => v.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir() {
    // Cada vez que se abre, parte de lo que está guardado.
    setMarcados(new Set(vendedores.filter((v) => v.en_tablero).map((v) => v.id)));
    setError(null);
    setAbierto(true);
  }

  function alternar(id: string) {
    setMarcados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function guardar() {
    if (marcados.size === 0) {
      setError("Elige al menos un vendedor.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await guardarTablero([...marcados]);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar la selección.");
        return;
      }
      setAbierto(false);
      show(`Cuadro actualizado: ${res.data?.mostrados ?? marcados.size} vendedores a la vista.`, "success");
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <Button variant="secondary" onClick={abrir} aria-expanded={false} aria-controls={idPanel}>
        Elegir vendedores
      </Button>
    );
  }

  return (
    <div id={idPanel} className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <fieldset className="flex flex-col gap-3" disabled={isPending}>
        <legend className="text-sm font-semibold text-neutral-900">Vendedores que se muestran en el cuadro</legend>
        <p className="text-xs text-neutral-500">
          Ocultar a alguien no cambia su meta ni los totales de la empresa. Para sacarlo de las metas, desactívalo en
          Configuración.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Button variant="link" onClick={() => setMarcados(new Set(vendedores.map((v) => v.id)))}>
            Marcar todos
          </Button>
          <Button variant="link" onClick={() => setMarcados(new Set(vendedores.filter((v) => v.activo).map((v) => v.id)))}>
            Solo activos
          </Button>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {vendedores.map((v) => (
            <li key={v.id}>
              <label className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 sm:min-h-0">
                <input
                  type="checkbox"
                  checked={marcados.has(v.id)}
                  onChange={() => alternar(v.id)}
                  className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <span className="min-w-0 truncate">{etiquetaVendedor(v.codigo, v.nombre)}</span>
                {!v.activo ? <span className="text-xs text-neutral-500">(inactivo)</span> : null}
              </label>
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {/* La secundaria va primero y la primaria al final (regla del kit). */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} loading={isPending}>
            {isPending ? "Guardando…" : `Mostrar ${marcados.size} ${marcados.size === 1 ? "vendedor" : "vendedores"}`}
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
