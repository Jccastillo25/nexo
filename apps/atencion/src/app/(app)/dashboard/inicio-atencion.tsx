"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Field, Select, StatusBadge, hora, useToast } from "@nexo/ui";
import type { MiEstado } from "@/lib/supabase/database.types";
import { cerrarAtencion, iniciarAtencion } from "../actions";

type Tipo = "recepcion" | "puesto" | null;

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
  // Qué botón disparó la acción en curso, para mostrar el spinner solo en él.
  const [accion, setAccion] = useState<Tipo | "cerrar">(null);
  const [sucursalId, setSucursalId] = useState(estado.sucursales.length === 1 ? estado.sucursales[0].id : "");
  const [errorSucursal, setErrorSucursal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ambos = estado.puede_recepcion && estado.puede_puesto;
  const ninguno = !estado.puede_recepcion && !estado.puede_puesto;

  function iniciar(tipo: Tipo) {
    if (estado.sucursales.length > 1 && !sucursalId) {
      setErrorSucursal("Elige la sucursal donde vas a trabajar.");
      return;
    }
    setAccion(tipo);
    setError(null);
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
    setAccion("cerrar");
    startTransition(async () => {
      const res = await cerrarAtencion();
      if (!res.ok) {
        setError(res.message ?? "No se pudo cerrar la atención.");
        return;
      }
      setError(null);
      show("Atención cerrada.", "success");
      router.refresh();
    });
  }

  const s = estado.sesion;
  const cargando = (tipo: Tipo | "cerrar") => isPending && accion === tipo;

  return (
    <section
      aria-label="Tu atención"
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
    >
      {s ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <StatusBadge label="Atención abierta" tone="positive" />
            <p className="mt-2 text-lg font-semibold text-neutral-900">
              {s.tipo === "puesto" ? s.puesto : "Recepción"} · {s.sucursal}
            </p>
            <p className="text-sm text-neutral-500">Desde las {hora(s.inicio)}. Se cierra sola a medianoche.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={cerrar} loading={cargando("cerrar")} disabled={isPending}>
              Cerrar atención
            </Button>
            <ButtonLink href="/atender">{s.tipo === "puesto" ? "Ir a mi puesto" : "Ir a recepción"}</ButtonLink>
          </div>
        </div>
      ) : ninguno ? (
        <p className="text-sm text-neutral-500">
          Tu rol permite ver Atención, pero no atender en recepción ni en un puesto.
        </p>
      ) : estado.sucursales.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No tienes sucursales asignadas. Pide a un administrador que te asigne una en Configuración → Usuarios.
        </p>
      ) : (
        <>
          <div>
            <p className="text-lg font-semibold text-neutral-900">¿Empezamos?</p>
            <p className="text-sm text-neutral-500">
              {estado.puede_puesto && !estado.puede_recepcion
                ? "Se te asignará automáticamente el primer puesto libre."
                : estado.puede_recepcion && !estado.puede_puesto
                  ? "Vas a atender la recepción."
                  : "Elige si vas a trabajar en recepción o en un puesto."}
            </p>
          </div>
          {estado.sucursales.length > 1 ? (
            <Field label="Sucursal" required error={errorSucursal} className="max-w-xs">
              <Select
                value={sucursalId}
                onChange={(e) => {
                  setSucursalId(e.target.value);
                  setErrorSucursal(null);
                }}
              >
                <option value="">Elige la sucursal</option>
                {estado.sucursales.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {ambos ? (
              <>
                {/* Mismo nivel a propósito: ninguna de las dos es "la principal". */}
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => iniciar("recepcion")}
                  loading={cargando("recepcion")}
                  disabled={isPending}
                >
                  Iniciar atención en recepción
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => iniciar("puesto")}
                  loading={cargando("puesto")}
                  disabled={isPending}
                >
                  Iniciar atención en un puesto
                </Button>
              </>
            ) : (
              <Button size="lg" onClick={() => iniciar(null)} loading={cargando(null)} disabled={isPending}>
                Iniciar atención
              </Button>
            )}
          </div>
        </>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </section>
  );
}
