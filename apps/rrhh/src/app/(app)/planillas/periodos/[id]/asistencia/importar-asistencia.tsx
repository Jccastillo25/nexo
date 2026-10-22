"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ConfirmDialog, DataTable, NexoIcon, StatusBadge, entero, fechaCorta, useToast } from "@nexo/ui";
import { diasTexto, horasTexto } from "@/lib/planilla/formato";
import type { PropuestaAsistencia } from "@/lib/planilla/tipos";
import { importarAsistencia } from "../../actions";

const CONCEPTO: Record<PropuestaAsistencia["concepto_codigo"], string> = {
  HORAS_EXTRA: "Horas extra",
  AUSENCIA: "Ausencia",
};

function claveDe(f: PropuestaAsistencia): string {
  return `${f.contrato_id}|${f.fecha}|${f.concepto_codigo}`;
}

/** "1 ausencia", "3 ausencias". */
function cuenta(n: number, uno: string, varios: string): string {
  return `${entero(n)} ${n === 1 ? uno : varios}`;
}

/** Personas distintas de las filas (por contrato: la propuesta no trae el id del empleado). */
function personasDe(filas: readonly PropuestaAsistencia[]): number {
  return new Set(filas.map((f) => f.contrato_id)).size;
}

/**
 * Propuesta de horas extra y ausencias desde las marcas del kiosco (B7).
 * Ninguna fila viene marcada: casi nadie marca en el kiosco y una ausencia
 * descuenta un día de salario, así que quien importa elige fila por fila (o
 * con "Marcar horas extra" / "Marcar ausencias"). Se guardan las filas
 * MARCADAS; las ya importadas no se pueden marcar. Si la selección incluye
 * ausencias, se confirma antes de importar. El texto de `detalle` solo se
 * muestra: no decide nada.
 *
 * La RPC es todo o nada e idempotente (importar dos veces no duplica) y
 * vuelve a validar cada fila contra la asistencia. Si falla, el error queda
 * en un aviso persistente y la selección se conserva.
 */
export function ImportarAsistencia({ planillaId, filas }: { planillaId: string; filas: PropuestaAsistencia[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, startTransition] = useTransition();
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegibles = filas.filter((f) => !f.ya_importada);
  const ausenciasNuevas = elegibles.filter((f) => f.concepto_codigo === "AUSENCIA");
  const horasNuevas = elegibles.filter((f) => f.concepto_codigo === "HORAS_EXTRA");

  const elegidas = elegibles.filter((f) => marcadas.has(claveDe(f)));
  const ausenciasElegidas = elegidas.filter((f) => f.concepto_codigo === "AUSENCIA");
  const horasElegidas = elegidas.length - ausenciasElegidas.length;
  const n = elegidas.length;
  const etiquetaImportar = `Importar ${cuenta(n, "novedad", "novedades")}`;

  function alternar(f: PropuestaAsistencia, marcada: boolean) {
    setMarcadas((actual) => {
      const siguiente = new Set(actual);
      if (marcada) siguiente.add(claveDe(f));
      else siguiente.delete(claveDe(f));
      return siguiente;
    });
  }

  function marcarTodas(grupo: readonly PropuestaAsistencia[]) {
    setMarcadas((actual) => {
      const siguiente = new Set(actual);
      for (const f of grupo) siguiente.add(claveDe(f));
      return siguiente;
    });
  }

  function pedirImportar() {
    if (n === 0) return;
    if (ausenciasElegidas.length > 0) setConfirmando(true);
    else importar();
  }

  function importar() {
    if (n === 0) return;
    setError(null);
    startTransition(async () => {
      const r = await importarAsistencia(
        planillaId,
        elegidas.map((f) => ({ contrato_id: f.contrato_id, fecha: f.fecha, concepto_codigo: f.concepto_codigo, cantidad: f.cantidad }))
      );
      setConfirmando(false);
      if (!r.ok) {
        // Todo o nada: no se importó ninguna fila; la selección queda igual para corregir y reintentar.
        setError(r.message);
        toast.show(r.message, "error");
        return;
      }
      setMarcadas(new Set());
      if (r.data === null) {
        toast.show("Importación terminada. Vuelve a calcular la planilla.", "success");
      } else if (r.data > 0) {
        toast.show(
          `Se importaron ${cuenta(r.data, "novedad", "novedades")}. Vuelve a calcular la planilla.`,
          "success"
        );
      } else {
        toast.show("No había novedades nuevas para importar.", "info");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert tone="error" title="No se pudieron importar las novedades">
          <p>{error}</p>
          <p className="mt-1">No se importó ninguna fila. Tu selección sigue marcada: corrígela e intenta de nuevo.</p>
        </Alert>
      ) : null}

      <p className="text-sm font-medium text-neutral-900 tabular-nums">
        {elegibles.length === 0
          ? "Todas las filas de la propuesta ya están importadas."
          : `${cuenta(ausenciasNuevas.length, "ausencia", "ausencias")} de ${cuenta(
              personasDe(ausenciasNuevas),
              "persona",
              "personas"
            )} · ${cuenta(horasNuevas.length, "fila de horas extra", "filas de horas extra")}`}
      </p>

      {ausenciasNuevas.length > 0 ? (
        <Alert tone="warning">
          Una ausencia descuenta un día de salario. Si la persona trabajó pero no marcó en el kiosco, no la importes.
        </Alert>
      ) : null}

      <DataTable
        rows={filas}
        rowKey={claveDe}
        caption="Horas extra y ausencias propuestas desde Asistencia"
        toolbar={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => marcarTodas(horasNuevas)}
                disabled={pendiente || horasNuevas.length === 0}
              >
                Marcar horas extra
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => marcarTodas(ausenciasNuevas)}
                disabled={pendiente || ausenciasNuevas.length === 0}
              >
                Marcar ausencias
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setMarcadas(new Set())} disabled={pendiente || n === 0}>
                Quitar selección
              </Button>
              <span className="text-xs text-neutral-500 tabular-nums" aria-live="polite">
                {entero(n)} de {entero(elegibles.length)} {elegibles.length === 1 ? "fila nueva marcada" : "filas nuevas marcadas"}
              </span>
            </div>
            <Button onClick={pedirImportar} loading={pendiente} disabled={n === 0} icon={<NexoIcon name="download" />}>
              {pendiente ? "Importando…" : etiquetaImportar}
            </Button>
          </div>
        }
        columns={[
          {
            key: "importar",
            header: <span className="sr-only">Importar</span>,
            width: "3rem",
            render: (f) => {
              const etiqueta = `Importar ${CONCEPTO[f.concepto_codigo].toLowerCase()} de ${f.empleado_nombre} del ${fechaCorta(f.fecha)}`;
              return (
                <input
                  type="checkbox"
                  aria-label={etiqueta}
                  checked={!f.ya_importada && marcadas.has(claveDe(f))}
                  disabled={f.ya_importada || pendiente}
                  onChange={(e) => alternar(f, e.target.checked)}
                  className="size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed"
                />
              );
            },
          },
          {
            key: "persona",
            header: "Persona",
            render: (f) => (
              <span className="flex flex-col">
                <span className="text-neutral-900">{f.empleado_nombre}</span>
                <span className="text-xs text-neutral-500 tabular-nums">N.º {f.numero_contrato}</span>
              </span>
            ),
          },
          { key: "fecha", header: "Fecha", render: (f) => <span className="tabular-nums">{fechaCorta(f.fecha)}</span> },
          {
            key: "concepto",
            header: "Concepto",
            render: (f) => (
              <span className="flex flex-wrap items-center gap-2">
                {CONCEPTO[f.concepto_codigo]}
                {f.ya_importada ? <StatusBadge label="Ya importada" tone="neutral" /> : null}
              </span>
            ),
          },
          {
            key: "cantidad",
            header: "Cantidad",
            numeric: true,
            render: (f) => (f.concepto_codigo === "HORAS_EXTRA" ? horasTexto(f.cantidad) : diasTexto(f.cantidad)),
          },
          { key: "detalle", header: "Detalle", render: (f) => <span className="text-neutral-600">{f.detalle ?? "—"}</span> },
        ]}
      />

      <ConfirmDialog
        open={confirmando}
        title="Importar ausencias"
        description={`Se registrarán ${cuenta(ausenciasElegidas.length, "ausencia", "ausencias")} de ${cuenta(
          personasDe(ausenciasElegidas),
          "persona",
          "personas"
        )}. Cada ausencia descuenta un día de salario en esta planilla. Confirma que no fueron permisos, vacaciones ni días trabajados sin marcar en el kiosco.`}
        confirmLabel={etiquetaImportar}
        destructive
        pending={pendiente}
        onCancel={() => setConfirmando(false)}
        onConfirm={importar}
      >
        {horasElegidas > 0 ? (
          <p className="text-sm text-neutral-700">
            También se importarán {cuenta(horasElegidas, "fila de horas extra", "filas de horas extra")}.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
