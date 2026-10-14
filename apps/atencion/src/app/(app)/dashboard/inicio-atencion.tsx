"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@nexo/ui";
import type { MiEstado } from "@/lib/supabase/database.types";
import { cerrarAtencion, iniciarAtencion } from "../actions";

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" });
}

/**
 * "Iniciar atención" / "Cerrar atención" (decisión 2026-10-14). El servidor
 * decide recepción o puesto según el rol y asigna el primer puesto libre;
 * aquí solo se pregunta lo que el servidor no puede deducir: la sucursal si
 * tiene varias, y recepción o puesto si el rol permite ambas.
 */
export default function InicioAtencion({ estado }: { estado: MiEstado }) {
  const router = useRouter();
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();
  const [sucursalId, setSucursalId] = useState(estado.sucursales.length === 1 ? estado.sucursales[0].id : "");
  const [error, setError] = useState<string | null>(null);

  const ambos = estado.puede_recepcion && estado.puede_puesto;
  const ninguno = !estado.puede_recepcion && !estado.puede_puesto;

  function iniciar(tipo: "recepcion" | "puesto" | null) {
    if (estado.sucursales.length > 1 && !sucursalId) {
      setError("Elegí la sucursal donde vas a trabajar.");
      return;
    }
    startTransition(async () => {
      const res = await iniciarAtencion(sucursalId || null, tipo);
      if (!res.ok || !res.data?.sesion) {
        setError(res.message ?? "No se pudo iniciar la atención.");
        return;
      }
      const s = res.data.sesion;
      show(s.tipo === "puesto" ? `Estás en ${s.puesto}.` : "Estás en recepción.", "success");
      router.push("/atender");
    });
  }

  function cerrar() {
    startTransition(async () => {
      const res = await cerrarAtencion();
      if (!res.ok) {
        setError(res.message ?? "No se pudo cerrar la atención.");
        show(res.message ?? "No se pudo cerrar la atención.", "error");
        return;
      }
      setError(null);
      show("Atención cerrada.", "success");
      router.refresh();
    });
  }

  const s = estado.sesion;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      {s ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Atención abierta</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {s.tipo === "puesto" ? s.puesto : "Recepción"} · {s.sucursal}
            </p>
            <p className="text-sm text-neutral-500">Desde las {hora(s.inicio)}. Se cierra sola a medianoche.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/atender"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {s.tipo === "puesto" ? "Ir a mi puesto" : "Ir a recepción"}
            </Link>
            <button
              type="button"
              onClick={cerrar}
              disabled={isPending}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              Cerrar atención
            </button>
          </div>
        </div>
      ) : ninguno ? (
        <p className="text-sm text-neutral-500">
          Tu rol permite ver Atención, pero no atender en recepción ni en un puesto.
        </p>
      ) : estado.sucursales.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No tenés sucursales asignadas. Pedile a un administrador que te asigne una en Configuración → Usuarios.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-lg font-semibold text-neutral-900">¿Empezamos?</p>
            <p className="text-sm text-neutral-500">
              {estado.puede_puesto && !estado.puede_recepcion
                ? "Se te asignará automáticamente el primer puesto libre."
                : estado.puede_recepcion && !estado.puede_puesto
                  ? "Vas a atender la recepción."
                  : "Elegí si vas a trabajar en recepción o en un puesto."}
            </p>
          </div>
          {estado.sucursales.length > 1 && (
            <select
              value={sucursalId}
              onChange={(e) => {
                setSucursalId(e.target.value);
                setError(null);
              }}
              aria-label="Sucursal"
              className="w-full max-w-xs rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Elegí la sucursal</option>
              {estado.sucursales.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap gap-2">
            {ambos ? (
              <>
                <button
                  type="button"
                  onClick={() => iniciar("recepcion")}
                  disabled={isPending}
                  className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Iniciar atención en recepción
                </button>
                <button
                  type="button"
                  onClick={() => iniciar("puesto")}
                  disabled={isPending}
                  className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Iniciar atención en un puesto
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => iniciar(null)}
                disabled={isPending}
                className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isPending ? "Iniciando…" : "Iniciar atención"}
              </button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
