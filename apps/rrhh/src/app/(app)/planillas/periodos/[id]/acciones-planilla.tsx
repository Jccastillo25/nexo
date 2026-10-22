"use client";

import { createContext, useContext, useId, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, ConfirmDialog, NexoIcon, entero, moneda, useToast } from "@nexo/ui";
import { BotonExportarCsv } from "@/components/planilla/boton-exportar-csv";
import { MotivoDialog } from "@/components/planilla/motivo-dialog";
import { PagoDialog, type DatosPago } from "@/components/planilla/pago-dialog";
import { sumarDias } from "@/lib/fecha-managua";
import { AVISO_CONTADOR, MOTIVO_SEPARACION } from "@/lib/planilla/estados";
import { RUTA, ayudaDeError, urlCsvPlanilla } from "@/lib/planilla/rutas";
import type { EstadoPlanilla } from "@/lib/planilla/tipos";
import { anularPlanilla, aprobarPlanilla, calcularPlanilla, pagarPlanilla } from "../actions";

// ---------------------------------------------------------------- error persistente de la acción

interface ErrorAccion {
  titulo: string;
  mensaje: string;
}

interface EstadoAcciones {
  error: ErrorAccion | null;
  setError: (e: ErrorAccion | null) => void;
}

const AccionesContexto = createContext<EstadoAcciones | null>(null);

/**
 * Envuelve la pantalla de la planilla para que las acciones del encabezado y
 * el botón "Calcular planilla" del estado vacío compartan el error de la
 * última acción, que se muestra debajo del encabezado (ErrorAccionPlanilla).
 * Los Server Components de adentro siguen siendo de servidor.
 */
export function AccionesPlanillaProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ErrorAccion | null>(null);
  return <AccionesContexto.Provider value={{ error, setError }}>{children}</AccionesContexto.Provider>;
}

function useErrorAccion(): EstadoAcciones {
  const ctx = useContext(AccionesContexto);
  if (!ctx) throw new Error("AccionesPlanilla debe ir dentro de AccionesPlanillaProvider.");
  return ctx;
}

/** Permisos que deciden qué enlaces de ayuda se muestran bajo un error. */
export interface PermisosAyuda {
  regimenVer: boolean;
  parametrosVer: boolean;
  novedadesVer: boolean;
  conceptosVer: boolean;
}

/** Error de la última acción (persistente) con enlaces de ayuda según el mensaje de la RPC y los permisos. */
export function ErrorAccionPlanilla({ permisos, periodo }: { permisos: PermisosAyuda; periodo: { inicio: string; fin: string } }) {
  const { error } = useErrorAccion();
  if (!error) return null;
  const ayuda = ayudaDeError(error.mensaje, permisos, periodo);
  return (
    <Alert tone="error" title={error.titulo}>
      <p>{error.mensaje}</p>
      {ayuda.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {ayuda.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="rounded-sm font-medium text-red-800 underline underline-offset-2 hover:text-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}

// ---------------------------------------------------------------- calcular

function useCalcular(planillaId: string) {
  const router = useRouter();
  const toast = useToast();
  const { setError } = useErrorAccion();
  const [pendiente, startTransition] = useTransition();

  function calcular() {
    startTransition(async () => {
      setError(null);
      const r = await calcularPlanilla(planillaId);
      if (!r.ok) {
        setError({ titulo: "No se pudo calcular la planilla", mensaje: r.message });
        toast.show(r.message, "error");
        return;
      }
      const { empleados, neto } = r.data;
      toast.show(
        empleados !== null && neto !== null
          ? `Planilla calculada: ${entero(empleados)} ${empleados === 1 ? "persona" : "personas"}, neto ${moneda(neto)}.`
          : "Planilla calculada.",
        "success"
      );
      router.refresh();
    });
  }

  return { calcular, pendiente };
}

/** "Calcular planilla" del estado vacío (borrador sin renglones). */
export function BotonCalcularPlanilla({ planillaId }: { planillaId: string }) {
  const { calcular, pendiente } = useCalcular(planillaId);
  return (
    <Button onClick={calcular} loading={pendiente} icon={<NexoIcon name="refresh" />}>
      {pendiente ? "Calculando…" : "Calcular planilla"}
    </Button>
  );
}

// ---------------------------------------------------------------- acciones del encabezado

export interface AccionesPlanillaProps {
  planillaId: string;
  estado: EstadoPlanilla;
  /** Nombre del período ("1.ª quincena de octubre de 2026"). */
  etiqueta: string;
  periodo: { inicio: string; fin: string };
  personas: number | null;
  neto: number | null;
  costo: number | null;
  /** Hay avisos de valores que confirma el contador: se repiten al aprobar y al pagar. */
  avisosContador: boolean;
  /** Quien mira generó o calculó la planilla (separación de funciones). */
  esAutor: boolean;
  /** Calculada con insumos que cambiaron después: hay que volver a calcular antes de aprobar. */
  cambiosSinCalcular: boolean;
  /** Hoy en Managua (lo calcula el servidor). */
  hoy: string;
  nombreCsv: string;
  puede: {
    calcular: boolean;
    aprobar: boolean;
    pagar: boolean;
    anular: boolean;
    exportar: boolean;
    imprimir: boolean;
  };
}

type Dialogo = "aprobar" | "pagar" | "anular" | null;

const AVISO_RECALCULAR = "Si la vuelves a calcular, la aprobación tendrá que hacerla otra persona.";

/**
 * Acciones de la planilla (B4), en el encabezado. Cada botón aparece solo
 * con su permiso y en el estado que corresponde; "Aprobar planilla" se ve
 * deshabilitado con el motivo cuando quien mira la generó o la calculó
 * (separación de funciones; la RPC también lo rechaza). Aprobada o pagada:
 * nada que cambie el cálculo, solo pagar, anular (si está aprobada),
 * exportar e imprimir.
 *
 * Si pagar o anular falla, el diálogo sigue abierto con lo escrito y el
 * error adentro; si falla aprobar, el error queda debajo del encabezado.
 */
export function AccionesPlanilla(props: AccionesPlanillaProps) {
  const { planillaId, estado, etiqueta, periodo, personas, neto, costo, avisosContador, esAutor, cambiosSinCalcular, hoy, puede } =
    props;
  const router = useRouter();
  const toast = useToast();
  const { setError } = useErrorAccion();
  const { calcular, pendiente: calculando } = useCalcular(planillaId);
  const [enCurso, startTransition] = useTransition();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null);
  const idMotivoAprobar = useId();
  const idAvisoRecalcular = useId();

  function abrir(d: Exclude<Dialogo, null>) {
    setErrorDialogo(null);
    setDialogo(d);
  }

  function cerrar() {
    setErrorDialogo(null);
    setDialogo(null);
  }

  /**
   * Ejecuta la acción del diálogo abierto. Con `errorEnDialogo`, un fallo deja
   * el diálogo abierto (conserva lo escrito) y muestra el error adentro; si
   * no, cierra el diálogo y deja el error persistente bajo el encabezado.
   */
  function ejecutar(
    titulo: string,
    accion: () => Promise<{ ok: true } | { ok: false; message: string }>,
    exito: string,
    errorEnDialogo = false
  ) {
    startTransition(async () => {
      setError(null);
      setErrorDialogo(null);
      const r = await accion();
      if (!r.ok) {
        if (errorEnDialogo) {
          setErrorDialogo(r.message);
          return;
        }
        setDialogo(null);
        setError({ titulo, mensaje: r.message });
        toast.show(r.message, "error");
        return;
      }
      setDialogo(null);
      toast.show(exito, "success");
      router.refresh();
    });
  }

  const calculable = estado === "borrador" || estado === "calculada";
  const impresa = estado === "aprobada" || estado === "pagada";
  const motivoAprobar = esAutor ? MOTIVO_SEPARACION : cambiosSinCalcular ? "Hubo cambios después del cálculo. Vuelve a calcular." : null;
  // Quien podría aprobarla pierde esa posibilidad al recalcularla (pasa a ser quien la calculó).
  const avisoRecalcular = estado === "calculada" && puede.aprobar && !esAutor ? AVISO_RECALCULAR : null;
  const fechaInicial = hoy < periodo.inicio ? periodo.inicio : hoy;

  const botonCalcular =
    calculable && puede.calcular ? (
      <Button
        variant={estado === "borrador" ? "primary" : "secondary"}
        onClick={calcular}
        loading={calculando}
        disabled={enCurso}
        aria-describedby={avisoRecalcular ? idAvisoRecalcular : undefined}
        icon={<NexoIcon name="refresh" />}
      >
        {calculando ? "Calculando…" : estado === "borrador" ? "Calcular planilla" : "Volver a calcular"}
      </Button>
    ) : null;

  /** Error de la última acción dentro del diálogo abierto (pagar o anular). */
  const alertaDialogo = (titulo: string) =>
    errorDialogo ? (
      <Alert tone="error" title={titulo}>
        {errorDialogo}
      </Alert>
    ) : null;

  const resumen = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-neutral-500">Período</dt>
      <dd className="text-neutral-900">{etiqueta}</dd>
      <dt className="text-neutral-500">Personas</dt>
      <dd className="text-neutral-900 tabular-nums">{entero(personas)}</dd>
      <dt className="text-neutral-500">Neto a pagar</dt>
      <dd className="font-medium text-neutral-900 tabular-nums">{moneda(neto)}</dd>
      <dt className="text-neutral-500">Costo del empleador</dt>
      <dd className="text-neutral-900 tabular-nums">{moneda(costo)}</dd>
    </dl>
  );

  return (
    <>
      {estado === "calculada" && puede.aprobar ? (
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            onClick={() => abrir("aprobar")}
            disabled={motivoAprobar !== null || enCurso || calculando}
            aria-describedby={motivoAprobar ? idMotivoAprobar : undefined}
            icon={<NexoIcon name="check-circle" />}
          >
            Aprobar planilla
          </Button>
          {motivoAprobar ? (
            <span id={idMotivoAprobar} className="text-xs text-neutral-500">
              {motivoAprobar}
            </span>
          ) : null}
        </div>
      ) : null}

      {estado === "aprobada" && puede.pagar ? (
        <Button onClick={() => abrir("pagar")} disabled={enCurso} icon={<NexoIcon name="cash" />}>
          Marcar como pagada
        </Button>
      ) : null}

      {botonCalcular && avisoRecalcular ? (
        <div className="flex flex-col items-start gap-1 sm:items-end">
          {botonCalcular}
          <span id={idAvisoRecalcular} className="max-w-xs text-xs text-neutral-500 sm:text-right">
            {avisoRecalcular}
          </span>
        </div>
      ) : (
        botonCalcular
      )}

      {estado !== "borrador" && estado !== "anulada" && puede.exportar ? (
        <BotonExportarCsv url={urlCsvPlanilla(planillaId)} nombreArchivo={props.nombreCsv} />
      ) : null}

      {impresa && puede.imprimir ? (
        <ButtonLink
          href={RUTA.imprimir.colillas(planillaId)}
          target="_blank"
          prefetch={false}
          variant="secondary"
          icon={<NexoIcon name="file" />}
        >
          Imprimir colillas
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </ButtonLink>
      ) : null}

      {impresa && puede.exportar ? (
        <ButtonLink
          href={RUTA.imprimir.cheques(planillaId)}
          target="_blank"
          prefetch={false}
          variant="secondary"
          icon={<NexoIcon name="receipt" />}
        >
          Detalle para cheques
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </ButtonLink>
      ) : null}

      {(calculable || estado === "aprobada") && puede.anular ? (
        <Button variant="destructive-outline" onClick={() => abrir("anular")} disabled={enCurso || calculando}>
          Anular planilla
        </Button>
      ) : null}

      <ConfirmDialog
        open={dialogo === "aprobar"}
        title="Aprobar planilla"
        description="Después de aprobarla no se puede editar. Mientras no esté pagada, para corregirla habrá que anularla y generar otra."
        confirmLabel="Aprobar planilla"
        pending={enCurso}
        onCancel={cerrar}
        onConfirm={() => ejecutar("No se pudo aprobar la planilla", () => aprobarPlanilla(planillaId), "Planilla aprobada.")}
      >
        <div className="flex flex-col gap-3">
          {resumen}
          {avisosContador ? <Alert tone="info">{AVISO_CONTADOR}</Alert> : null}
        </div>
      </ConfirmDialog>

      <PagoDialog
        open={dialogo === "pagar"}
        pending={enCurso}
        fechaMin={periodo.inicio}
        fechaMax={sumarDias(hoy, 31)}
        fechaInicial={fechaInicial}
        onCancel={cerrar}
        onConfirm={(datos: DatosPago) =>
          ejecutar(
            "No se pudo marcar la planilla como pagada",
            () => pagarPlanilla(planillaId, datos),
            "Planilla marcada como pagada.",
            true
          )
        }
      >
        <div className="flex flex-col gap-3 text-sm text-neutral-700">
          {alertaDialogo("No se pudo marcar la planilla como pagada")}
          <p>
            <span className="font-medium text-neutral-900">Neto a pagar: {moneda(neto)}</span> · {entero(personas)}{" "}
            {personas === 1 ? "persona" : "personas"}
          </p>
          {avisosContador ? <Alert tone="info">{AVISO_CONTADOR}</Alert> : null}
          <p>Marcar como pagada no cambia los montos. Registra cómo y cuándo se pagó.</p>
          <Alert tone="warning">Después de marcarla como pagada ya no se podrá anular.</Alert>
        </div>
      </PagoDialog>

      <MotivoDialog
        open={dialogo === "anular"}
        title="Anular planilla"
        description="La planilla queda anulada y sus novedades vuelven a quedar pendientes para la planilla de reemplazo. Esta acción no se puede deshacer."
        confirmLabel="Anular planilla"
        destructive
        pending={enCurso}
        onCancel={cerrar}
        onConfirm={(motivo) =>
          ejecutar("No se pudo anular la planilla", () => anularPlanilla(planillaId, motivo), "Planilla anulada.", true)
        }
      >
        {alertaDialogo("No se pudo anular la planilla")}
      </MotivoDialog>
    </>
  );
}
