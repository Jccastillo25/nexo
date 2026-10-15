"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog, FormSection, StatusBadge, useToast } from "@nexo/ui";
import { cancelarTurno, crearTurno, reactivarTurno } from "../actions";
import { horaCorta, useCola } from "./use-cola";
import { duracion, transcurrido, useReloj } from "./reloj";
import NoSePresentaron from "./no-se-presentaron";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

/** Recepción: registra al cliente (nombre, teléfono, factura) y entrega el número. */
export default function Recepcion({
  sucursalId,
  puedeAnular,
  puedeReactivar,
}: {
  sucursalId: string;
  puedeAnular: boolean;
  puedeReactivar: boolean;
}) {
  const { show } = useToast();
  const { cola, error: errorCola, recargar, desfase } = useCola({ sucursalId });
  const ahora = useReloj(desfase);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [factura, setFactura] = useState("");
  const [ultimo, setUltimo] = useState<{ numero: number; nombre: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Factura con un "no se presentó" de hoy: se ofrece reactivar ese turno en vez de crear otro.
  // Queda ligado a la factura enviada y se descarta si la factura cambia.
  const [reactivable, setReactivable] = useState<{ id: string; numero: number; factura: string } | null>(null);
  const [anular, setAnular] = useState<{ id: string; numero: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const pendientes = cola.filter((t) => t.estado === "esperando" || t.estado === "llamado");

  function entregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("Escribí el nombre del cliente.");
      return;
    }
    startTransition(async () => {
      const res = await crearTurno(nombre, telefono, factura);
      if (!res.ok || !res.data) {
        setError(res.message ?? "No se pudo entregar el turno.");
        setReactivable(res.reactivable ? { ...res.reactivable, factura } : null);
        return;
      }
      setReactivable(null);
      setUltimo({ numero: res.data.numero, nombre: nombre.trim() });
      setNombre("");
      setTelefono("");
      setFactura("");
      setError(null);
      show(`Turno ${res.data.numero} entregado.`, "success");
      await recargar();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <FormSection title="Nuevo cliente">
          <form onSubmit={entregar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="r_nombre" className={labelClass}>
                Nombre
              </label>
              <input
                id="r_nombre"
                value={nombre}
                maxLength={120}
                autoFocus
                onChange={(e) => {
                  setNombre(e.target.value);
                  setError(null);
                }}
                className={inputClass}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="r_tel" className={labelClass}>
                  Teléfono
                </label>
                <input id="r_tel" value={telefono} maxLength={30} inputMode="tel" onChange={(e) => setTelefono(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="r_fac" className={labelClass}>
                  Número de factura
                </label>
                <input
                  id="r_fac"
                  value={factura}
                  maxLength={50}
                  onChange={(e) => {
                    setFactura(e.target.value);
                    setReactivable(null);
                  }}
                  className={inputClass}
                />
              </div>
            </div>
            {error && (
              <div role="alert" className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p>{error}</p>
                {reactivable && reactivable.factura === factura &&
                  (puedeReactivar ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await reactivarTurno(reactivable.id);
                          if (!res.ok) {
                            setError(res.message ?? "No se pudo reactivar.");
                            return;
                          }
                          show(`Turno ${reactivable.numero} reactivado: vuelve al final de la fila.`, "success");
                          setUltimo({ numero: reactivable.numero, nombre: nombre.trim() });
                          setNombre("");
                          setTelefono("");
                          setFactura("");
                          setError(null);
                          setReactivable(null);
                          await recargar();
                        })
                      }
                      className="self-start rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Reactivar turno {reactivable.numero}
                    </button>
                  ) : (
                    <p className="text-xs">Pedile a alguien con permiso de reactivar turnos que lo devuelva a la fila.</p>
                  ))}
              </div>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? "Entregando…" : "Entregar turno"}
            </button>
          </form>
        </FormSection>

        {ultimo && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Último turno entregado</p>
            <p className="mt-1 text-6xl font-bold tabular-nums text-blue-900">{ultimo.numero}</p>
            <p className="mt-1 text-sm text-blue-800">{ultimo.nombre}</p>
          </div>
        )}

        <NoSePresentaron cola={cola} puedeReactivar={puedeReactivar} alReactivar={recargar} />
      </div>

      <FormSection title={`En espera (${pendientes.filter((t) => t.estado === "esperando").length})`}>
        {errorCola && <p className="text-sm text-red-600">{errorCola}</p>}
        {pendientes.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay clientes esperando.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {pendientes.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-2xl font-bold tabular-nums text-neutral-900">{t.numero}</span>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{t.cliente_nombre}</p>
                    <p className="text-xs text-neutral-400">
                      {t.estado === "esperando" ? (
                        <>
                          Esperando{" "}
                          <span className="font-semibold tabular-nums text-neutral-700">
                            {duracion(transcurrido(t.en_fila_desde, ahora))}
                          </span>{" "}
                          · {horaCorta(t.creado_en)}
                        </>
                      ) : (
                        horaCorta(t.creado_en)
                      )}
                      {t.factura ? ` · Factura ${t.factura}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.estado === "llamado" ? (
                    <StatusBadge label={`En ${t.puesto}`} tone="info" />
                  ) : (
                    puedeAnular && (
                      <button
                        type="button"
                        onClick={() => setAnular({ id: t.id, numero: t.numero })}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Anular
                      </button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <ConfirmDialog
        open={!!anular}
        title={`¿Anular el turno ${anular?.numero}?`}
        description="El cliente sale de la fila. Esta acción no se puede deshacer."
        confirmLabel="Anular"
        destructive
        pending={isPending}
        onCancel={() => setAnular(null)}
        onConfirm={() =>
          startTransition(async () => {
            if (!anular) return;
            const res = await cancelarTurno(anular.id);
            setAnular(null);
            show(res.ok ? "Turno anulado." : res.message ?? "No se pudo anular.", res.ok ? "success" : "error");
            await recargar();
          })
        }
      />
    </div>
  );
}
