"use client";

import { useTransition } from "react";
import { FormSection, useToast } from "@nexo/ui";
import { llamarTurno, rellamarTurno, terminarTurno } from "../actions";
import { horaCorta, useCola } from "./use-cola";

/**
 * Puesto de atención: llamar al siguiente, repetir el llamado, terminar
 * (atendido / ausente) y, con permiso, llamar a un turno fuera de orden.
 */
export default function Puesto({
  puesto,
  puedeFueraOrden,
  puedeFinalizar,
  puedeAusente,
}: {
  puesto: string;
  puedeFueraOrden: boolean;
  puedeFinalizar: boolean;
  puedeAusente: boolean;
}) {
  const { show } = useToast();
  const { cola, error: errorCola, recargar } = useCola();
  const [isPending, startTransition] = useTransition();

  const actual = cola.find((t) => t.estado === "llamado" && t.puesto === puesto) ?? null;
  const esperando = cola.filter((t) => t.estado === "esperando");

  function ejecutar(accion: () => Promise<{ ok: boolean; message?: string }>, exito: string) {
    startTransition(async () => {
      const res = await accion();
      show(res.ok ? exito : res.message ?? "No se pudo completar la acción.", res.ok ? "success" : "error");
      await recargar();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex flex-col items-center justify-center gap-5 rounded-xl border border-neutral-200 bg-white p-8 text-center">
        {actual ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Atendiendo</p>
            <p className="text-8xl font-bold tabular-nums text-neutral-900">{actual.numero}</p>
            <div>
              <p className="text-lg font-medium text-neutral-800">{actual.cliente_nombre}</p>
              <p className="text-sm text-neutral-500">
                {[actual.cliente_telefono, actual.factura ? `Factura ${actual.factura}` : null].filter(Boolean).join(" · ") ||
                  "Sin teléfono ni factura"}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Llamado {actual.veces_llamado} {actual.veces_llamado === 1 ? "vez" : "veces"} · {horaCorta(actual.llamado_en)}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => ejecutar(() => rellamarTurno(), `Turno ${actual.numero} llamado de nuevo.`)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                Repetir llamado
              </button>
              {puedeAusente && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => ejecutar(() => terminarTurno("ausente"), `Turno ${actual.numero} marcado ausente.`)}
                  className="rounded-md border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  No se presentó
                </button>
              )}
              {puedeFinalizar && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => ejecutar(() => terminarTurno("atendido"), `Turno ${actual.numero} atendido.`)}
                  className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Atendido
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-500">
              {esperando.length === 0 ? "No hay clientes esperando." : `${esperando.length} en espera.`}
            </p>
            <button
              type="button"
              disabled={isPending || esperando.length === 0}
              onClick={() => ejecutar(() => llamarTurno(null), "Turno llamado.")}
              className="rounded-xl bg-blue-600 px-10 py-5 text-xl font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Llamar siguiente
            </button>
          </>
        )}
      </section>

      <FormSection title={`Fila (${esperando.length})`}>
        {errorCola && <p className="text-sm text-red-600">{errorCola}</p>}
        {esperando.length === 0 ? (
          <p className="text-sm text-neutral-500">Nadie en espera.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {esperando.map((t, i) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-2xl font-bold tabular-nums text-neutral-900">{t.numero}</span>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{t.cliente_nombre}</p>
                    <p className="text-xs text-neutral-400">Desde las {horaCorta(t.creado_en)}</p>
                  </div>
                </div>
                {puedeFueraOrden && !actual && i > 0 && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => ejecutar(() => llamarTurno(t.id), `Turno ${t.numero} llamado fuera de orden.`)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    Llamar ahora
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </FormSection>
    </div>
  );
}
