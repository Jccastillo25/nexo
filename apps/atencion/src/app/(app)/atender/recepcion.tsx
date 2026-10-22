"use client";

import { useState, useTransition } from "react";
import { Alert, Button, ConfirmDialog, Field, FormSection, Input, StatusBadge, useToast } from "@nexo/ui";
import { cancelarTurno, crearTurno, reactivarTurno } from "../actions";
import { horaCorta, useCola } from "./use-cola";
import { duracion, transcurrido, useReloj } from "./reloj";
import NoSePresentaron from "./no-se-presentaron";

/** Recepción: registra al cliente (nombre, teléfono, factura) y entrega el número. */
export default function Recepcion({
  sucursalId,
  puedeEntregar,
  puedeAnular,
  puedeReactivar,
}: {
  sucursalId: string;
  puedeEntregar: boolean;
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
  // Error del nombre (junto al campo) y error devuelto por el servidor (aviso).
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Factura con un "no se presentó" de hoy: se ofrece reactivar ese turno en vez de crear otro.
  // Queda ligado a la factura enviada y se descarta si la factura cambia.
  const [reactivable, setReactivable] = useState<{ id: string; numero: number; factura: string } | null>(null);
  const [anular, setAnular] = useState<{ id: string; numero: number } | null>(null);
  const [entregando, startEntrega] = useTransition();
  const [isPending, startTransition] = useTransition();

  const pendientes = cola.filter((t) => t.estado === "esperando" || t.estado === "llamado");

  function limpiar() {
    setNombre("");
    setTelefono("");
    setFactura("");
    setError(null);
    setErrorNombre(null);
    setReactivable(null);
  }

  function entregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorNombre("Escribe el nombre del cliente.");
      return;
    }
    startEntrega(async () => {
      const res = await crearTurno(nombre, telefono, factura);
      if (!res.ok || !res.data) {
        setError(res.message ?? "No se pudo entregar el turno.");
        setReactivable(res.reactivable ? { ...res.reactivable, factura } : null);
        return;
      }
      setUltimo({ numero: res.data.numero, nombre: nombre.trim() });
      limpiar();
      show(`Turno ${res.data.numero} entregado.`, "success");
      await recargar();
    });
  }

  function reactivarPorFactura(turno: { id: string; numero: number }) {
    startTransition(async () => {
      const res = await reactivarTurno(turno.id);
      if (!res.ok) {
        setError(res.message ?? "No se pudo reactivar el turno.");
        return;
      }
      show(`Turno ${turno.numero} reactivado: vuelve al final de la fila.`, "success");
      setUltimo({ numero: turno.numero, nombre: nombre.trim() });
      limpiar();
      await recargar();
    });
  }

  const ofrecerReactivar = reactivable !== null && reactivable.factura === factura;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <FormSection title="Nuevo cliente">
          {puedeEntregar ? (
            <form onSubmit={entregar} noValidate className="flex flex-col gap-4">
              <Field label="Nombre" required error={errorNombre}>
                <Input
                  value={nombre}
                  maxLength={120}
                  autoFocus
                  autoComplete="off"
                  onChange={(e) => {
                    setNombre(e.target.value);
                    setErrorNombre(null);
                  }}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Teléfono" optional>
                  <Input
                    type="tel"
                    value={telefono}
                    maxLength={30}
                    inputMode="tel"
                    autoComplete="off"
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </Field>
                <Field label="Número de factura" optional>
                  <Input
                    value={factura}
                    maxLength={50}
                    autoComplete="off"
                    onChange={(e) => {
                      setFactura(e.target.value);
                      setReactivable(null);
                    }}
                  />
                </Field>
              </div>
              {error ? (
                <Alert
                  tone="error"
                  action={
                    ofrecerReactivar && puedeReactivar ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={isPending}
                        onClick={() => reactivarPorFactura(reactivable)}
                      >
                        Reactivar turno {reactivable.numero}
                      </Button>
                    ) : undefined
                  }
                >
                  <p>{error}</p>
                  {ofrecerReactivar && !puedeReactivar ? (
                    <p className="mt-1 text-xs">
                      Pide a alguien con permiso para reactivar turnos que lo devuelva a la fila.
                    </p>
                  ) : null}
                </Alert>
              ) : null}
              <Button type="submit" size="lg" fullWidth loading={entregando} disabled={isPending}>
                Entregar turno
              </Button>
            </form>
          ) : (
            <Alert tone="info">Tu rol no permite entregar turnos. Puedes ver la fila de la sucursal.</Alert>
          )}
        </FormSection>

        {ultimo && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center" role="status">
            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">Último turno entregado</p>
            <p className="mt-1 text-6xl font-bold text-blue-900 tabular-nums">{ultimo.numero}</p>
            <p className="mt-1 text-sm text-blue-800">{ultimo.nombre}</p>
          </div>
        )}

        <NoSePresentaron cola={cola} puedeReactivar={puedeReactivar} alReactivar={recargar} />
      </div>

      <FormSection title={`En espera (${pendientes.filter((t) => t.estado === "esperando").length})`}>
        {errorCola ? <Alert tone="error">{errorCola}</Alert> : null}
        {pendientes.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay clientes esperando.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {pendientes.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-12 shrink-0 text-2xl font-bold text-neutral-900 tabular-nums">{t.numero}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{t.cliente_nombre}</p>
                    <p className="text-xs text-neutral-500">
                      {t.estado === "esperando" ? (
                        <>
                          Esperando{" "}
                          <span className="font-semibold text-neutral-700 tabular-nums">
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
                <div className="flex shrink-0 items-center gap-2">
                  {t.estado === "llamado" ? (
                    <StatusBadge label={`En ${t.puesto}`} tone="info" />
                  ) : puedeAnular ? (
                    <Button
                      size="sm"
                      variant="destructive-outline"
                      onClick={() => setAnular({ id: t.id, numero: t.numero })}
                      aria-label={`Anular el turno ${t.numero}`}
                    >
                      Anular
                    </Button>
                  ) : null}
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
            show(res.ok ? "Turno anulado." : (res.message ?? "No se pudo anular."), res.ok ? "success" : "error");
            await recargar();
          })
        }
      />
    </div>
  );
}
