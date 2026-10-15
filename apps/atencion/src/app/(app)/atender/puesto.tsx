"use client";

import { useEffect, useTransition } from "react";
import { FormSection, useToast } from "@nexo/ui";
import { llamarTurno, rellamarTurno, terminarTurno } from "../actions";
import { horaCorta, useCola } from "./use-cola";
import { useAvisoSonoro } from "./aviso-sonoro";
import { duracion, transcurrido, useReloj } from "./reloj";

/**
 * Puesto de atención: llamar al siguiente, repetir el llamado, terminar
 * (atendido / ausente) y, con permiso, llamar a un turno fuera de orden.
 */
export default function Puesto({
  sucursalId,
  puesto,
  puedeFueraOrden,
  puedeFinalizar,
  puedeAusente,
}: {
  sucursalId: string;
  puesto: string;
  puedeFueraOrden: boolean;
  puedeFinalizar: boolean;
  puedeAusente: boolean;
}) {
  const { show } = useToast();
  const aviso = useAvisoSonoro();
  const { cola, error: errorCola, recargar, enVivo, desfase } = useCola({
    sucursalId,
    onNuevos: (nuevos) => {
      aviso.sonar();
      show(
        nuevos.length === 1 ? `Nuevo cliente en fila: turno ${nuevos[0].numero}.` : `${nuevos.length} clientes nuevos en fila.`,
        "info"
      );
    },
  });
  const [isPending, startTransition] = useTransition();

  const actual = cola.find((t) => t.estado === "llamado" && t.puesto === puesto) ?? null;
  const esperando = cola.filter((t) => t.estado === "esperando");
  const ahora = useReloj(desfase);
  // Último turno terminado en este puesto (atendido o ausente), con sus tiempos guardados.
  const ultimo =
    cola
      .filter((t) => t.puesto === puesto && t.finalizado_en && (t.estado === "atendido" || t.estado === "ausente"))
      .sort((a, b) => Date.parse(b.finalizado_en!) - Date.parse(a.finalizado_en!))[0] ?? null;

  // La cantidad en espera en el título de la pestaña, visible desde otra ventana.
  useEffect(() => {
    const base = `${puesto || "Puesto"} · Atención`;
    document.title = esperando.length > 0 ? `(${esperando.length}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [esperando.length, puesto]);

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
            <dl className="grid grid-cols-2 gap-6 text-center">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Esperó</dt>
                <dd className="text-xl font-semibold tabular-nums text-neutral-700">
                  {duracion(transcurrido(actual.creado_en, actual.inicio_atencion_en))}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-blue-700">En atención</dt>
                <dd className="text-3xl font-bold tabular-nums text-blue-700">
                  {duracion(transcurrido(actual.inicio_atencion_en, ahora))}
                </dd>
              </div>
            </dl>
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
        {ultimo && (
          <p className="text-xs text-neutral-500">
            Último: turno {ultimo.numero} ({ultimo.estado === "atendido" ? "atendido" : "no se presentó"}) · esperó{" "}
            <span className="tabular-nums">{duracion(transcurrido(ultimo.creado_en, ultimo.inicio_atencion_en))}</span> ·
            atención <span className="tabular-nums">{duracion(transcurrido(ultimo.inicio_atencion_en, ultimo.finalizado_en))}</span>
          </p>
        )}
      </section>

      <FormSection title={`Fila (${esperando.length})`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={enVivo ? "text-emerald-700" : "text-neutral-500"}>
            {enVivo ? "● En vivo" : "○ Reconectando… (se actualiza cada 15 s)"}
          </span>
          <button
            type="button"
            onClick={aviso.alternar}
            aria-pressed={aviso.activado}
            className={`rounded-md border px-3 py-1.5 font-semibold ${
              aviso.activado
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {aviso.activado ? "Sonido activado" : "Activar sonido de nuevos clientes"}
          </button>
        </div>
        {aviso.activado && aviso.bloqueado && (
          <p className="text-xs text-amber-700">Tocá cualquier parte de la página para habilitar el sonido.</p>
        )}
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
                    <p className="text-xs text-neutral-500">
                      Esperando{" "}
                      <span className="font-semibold tabular-nums text-neutral-800">
                        {duracion(transcurrido(t.creado_en, ahora))}
                      </span>{" "}
                      · desde las {horaCorta(t.creado_en)}
                    </p>
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
