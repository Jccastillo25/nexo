"use client";

import { useEffect, useTransition } from "react";
import { Alert, Button, FormSection, useToast } from "@nexo/ui";
import { llamarTurno, rellamarTurno, terminarTurno } from "../actions";
import { horaCorta, useCola } from "./use-cola";
import { useAvisoSonoro } from "./aviso-sonoro";
import { duracion, transcurrido, useReloj } from "./reloj";
import NoSePresentaron from "./no-se-presentaron";

/**
 * Puesto de atención: llamar al siguiente, repetir el llamado, terminar
 * (atendido / ausente) y, con permiso, llamar a un turno fuera de orden.
 * Cada botón se muestra solo con su permiso; el servidor vuelve a validarlo.
 */
export default function Puesto({
  sucursalId,
  puesto,
  puedeLlamar,
  puedeFueraOrden,
  puedeFinalizar,
  puedeAusente,
  puedeReactivar,
}: {
  sucursalId: string;
  puedeReactivar: boolean;
  puesto: string;
  puedeLlamar: boolean;
  puedeFueraOrden: boolean;
  puedeFinalizar: boolean;
  puedeAusente: boolean;
}) {
  const { show } = useToast();
  const aviso = useAvisoSonoro();
  const {
    cola,
    error: errorCola,
    recargar,
    enVivo,
    desfase,
  } = useCola({
    sucursalId,
    onNuevos: (nuevos) => {
      aviso.sonar();
      show(
        nuevos.length === 1
          ? `Nuevo cliente en fila: turno ${nuevos[0].numero}.`
          : `${nuevos.length} clientes nuevos en fila.`,
        "info",
      );
    },
  });
  const [isPending, startTransition] = useTransition();

  const actual =
    cola.find((t) => t.estado === "llamado" && t.puesto === puesto) ?? null;
  const esperando = cola.filter((t) => t.estado === "esperando");
  const ahora = useReloj(desfase);
  // Último turno terminado en este puesto (atendido o ausente), con sus tiempos guardados.
  const ultimo =
    cola
      .filter(
        (t) =>
          t.puesto === puesto &&
          t.finalizado_en &&
          (t.estado === "atendido" || t.estado === "ausente"),
      )
      .sort(
        (a, b) => Date.parse(b.finalizado_en!) - Date.parse(a.finalizado_en!),
      )[0] ?? null;

  // La cantidad en espera en el título de la pestaña, visible desde otra ventana.
  useEffect(() => {
    const base = `${puesto || "Puesto"} · Atención`;
    document.title =
      esperando.length > 0 ? `(${esperando.length}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [esperando.length, puesto]);

  function ejecutar(
    accion: () => Promise<{ ok: boolean; message?: string }>,
    exito: string,
  ) {
    startTransition(async () => {
      const res = await accion();
      show(
        res.ok ? exito : (res.message ?? "No se pudo completar la acción."),
        res.ok ? "success" : "error",
      );
      await recargar();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex flex-col items-center justify-center gap-5 rounded-xl border border-neutral-200 bg-white p-8 text-center">
        {actual ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Atendiendo
            </p>
            <p className="text-8xl font-bold tabular-nums text-neutral-900">
              {actual.numero}
            </p>
            <div>
              <p className="text-lg font-medium text-neutral-800">
                {actual.cliente_nombre}
              </p>
              <p className="text-sm text-neutral-500">
                {[
                  actual.cliente_telefono,
                  actual.factura ? `Factura ${actual.factura}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sin teléfono ni factura"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Llamado {actual.veces_llamado}{" "}
                {actual.veces_llamado === 1 ? "vez" : "veces"} ·{" "}
                {horaCorta(actual.llamado_en)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-6 text-center">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">
                  Esperó
                </dt>
                <dd className="text-xl font-semibold tabular-nums text-neutral-700">
                  {duracion(
                    transcurrido(
                      actual.en_fila_desde,
                      actual.inicio_atencion_en,
                    ),
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-blue-700">
                  En atención
                </dt>
                <dd className="text-3xl font-bold tabular-nums text-blue-700">
                  {duracion(transcurrido(actual.inicio_atencion_en, ahora))}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap justify-center gap-2">
              {puedeLlamar && (
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={isPending}
                  onClick={() =>
                    ejecutar(
                      () => rellamarTurno(),
                      `Turno ${actual.numero} llamado de nuevo.`,
                    )
                  }
                >
                  Repetir llamado
                </Button>
              )}
              {puedeAusente && (
                <Button
                  variant="destructive-outline"
                  size="lg"
                  disabled={isPending}
                  onClick={() =>
                    ejecutar(
                      () => terminarTurno("ausente"),
                      `Turno ${actual.numero} marcado como no presentado.`,
                    )
                  }
                >
                  No se presentó
                </Button>
              )}
              {puedeFinalizar && (
                <Button
                  size="lg"
                  disabled={isPending}
                  onClick={() =>
                    ejecutar(
                      () => terminarTurno("atendido"),
                      `Turno ${actual.numero} atendido.`,
                    )
                  }
                >
                  Atendido
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-500">
              {esperando.length === 0
                ? "No hay clientes esperando."
                : `${esperando.length} en espera.`}
            </p>
            {puedeLlamar ? (
              <Button
                size="lg"
                className="min-h-14 min-w-56"
                loading={isPending}
                disabled={esperando.length === 0}
                onClick={() =>
                  ejecutar(() => llamarTurno(null), "Turno llamado.")
                }
              >
                <span className="text-lg">Llamar siguiente</span>
              </Button>
            ) : (
              <p className="text-sm text-neutral-500">
                Tu rol no permite llamar turnos en este puesto.
              </p>
            )}
          </>
        )}
        {ultimo && (
          <p className="text-xs text-neutral-500">
            Último: turno {ultimo.numero} (
            {ultimo.estado === "atendido" ? "atendido" : "no se presentó"}) ·
            esperó{" "}
            <span className="tabular-nums">
              {duracion(
                transcurrido(ultimo.en_fila_desde, ultimo.inicio_atencion_en),
              )}
            </span>{" "}
            · atención{" "}
            <span className="tabular-nums">
              {duracion(
                transcurrido(ultimo.inicio_atencion_en, ultimo.finalizado_en),
              )}
            </span>
          </p>
        )}
      </section>

      <div className="flex flex-col gap-6">
        <FormSection title={`Fila (${esperando.length})`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className={enVivo ? "text-emerald-700" : "text-neutral-500"}>
              {enVivo
                ? "● En vivo"
                : "○ Reconectando… (se actualiza cada 15 s)"}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={aviso.alternar}
              aria-pressed={aviso.activado}
            >
              {aviso.activado
                ? "Sonido activado"
                : "Activar sonido de nuevos clientes"}
            </Button>
          </div>
          {aviso.activado && aviso.bloqueado && (
            <p className="text-xs text-amber-700">
              Toca cualquier parte de la página para habilitar el sonido.
            </p>
          )}
          {errorCola && <Alert tone="error">{errorCola}</Alert>}
          {esperando.length === 0 ? (
            <p className="text-sm text-neutral-500">Nadie en espera.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {esperando.map((t, i) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-2xl font-bold tabular-nums text-neutral-900">
                      {t.numero}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {t.cliente_nombre}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Esperando{" "}
                        <span className="font-semibold tabular-nums text-neutral-800">
                          {duracion(transcurrido(t.en_fila_desde, ahora))}
                        </span>{" "}
                        · desde las {horaCorta(t.en_fila_desde)}
                        {t.reactivaciones > 0 && " · reactivado"}
                      </p>
                    </div>
                  </div>
                  {puedeFueraOrden && !actual && i > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      aria-label={`Llamar ahora el turno ${t.numero}`}
                      onClick={() =>
                        ejecutar(
                          () => llamarTurno(t.id),
                          `Turno ${t.numero} llamado fuera de orden.`,
                        )
                      }
                    >
                      Llamar ahora
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FormSection>
        <NoSePresentaron
          cola={cola}
          puedeReactivar={puedeReactivar}
          alReactivar={recargar}
        />
      </div>
    </div>
  );
}
