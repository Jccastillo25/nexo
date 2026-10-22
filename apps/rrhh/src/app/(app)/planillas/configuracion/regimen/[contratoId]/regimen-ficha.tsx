"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, Field, Input, NexoIcon, Textarea, fechaCorta, useToast } from "@nexo/ui";
import { MotivoDialog } from "@/components/planilla/motivo-dialog";
import { MOTIVO_MAX, validarMotivo } from "@/lib/planilla/estados";
import { REGIMEN, REGIMEN_INSS, etiquetaIr } from "@/lib/planilla/etiquetas";
import { aFraccion, aPorcentaje } from "@/lib/planilla/formato";
import { esFechaIso } from "@/lib/planilla/periodos";
import type { EstadoContrato, MetodoIr, Regimen, RegimenInss } from "@/lib/planilla/tipos";
import { AlertaError } from "../../_compartido/alerta-error";
import { cambiarRegimen, descartarAvisoRegimen, fijarAntiguedad, type CambioRegimenInput } from "../actions";

/** Régimen vigente del contrato (props serializables desde la página). */
export interface RegimenActual {
  contratoId: string;
  estadoContrato: EstadoContrato;
  fechaInicio: string | null;
  fechaAntiguedad: string | null;
  /** Null: el contrato no tiene régimen. */
  regimen: Regimen | null;
  regimenInss: RegimenInss | null;
  metodoIr: MetodoIr | null;
  porcentajeIr: number | null;
  pagaVacaciones: boolean | null;
  pagaAguinaldo: boolean | null;
  pagaIndemnizacion: boolean | null;
  /** Aviso de régimen vigente sin descartar. */
  tieneAviso: boolean;
}

const CONTROL =
  "size-4 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed";
const LEYENDA = "mb-1.5 text-[13px] leading-5 font-medium text-neutral-700";
const PORCENTAJE = /^\d{1,3}(\.\d{1,2})?$/;

/** "Laboral (INSS integral)", "Servicios profesionales (exento de IR)", "Sin régimen". */
function describir(r: {
  regimen: Regimen | null;
  regimenInss: RegimenInss | null;
  metodoIr: MetodoIr | null;
  porcentajeIr: number | null;
}): string {
  if (!r.regimen) return "Sin régimen";
  if (r.regimen === "laboral") return `${REGIMEN.laboral} (INSS ${(REGIMEN_INSS[r.regimenInss ?? "integral"] ?? "").toLowerCase()})`;
  const ir = r.metodoIr === "exento" ? "exento de IR" : etiquetaIr({ metodo_ir: r.metodoIr, porcentaje_ir: r.porcentajeIr }).toLowerCase();
  return `${REGIMEN.servicios_profesionales} (${ir})`;
}

/**
 * Acciones de la ficha de régimen (A2), cada una solo con su permiso (la
 * acción del servidor y la RPC vuelven a validarlo):
 * - Cambiar / Asignar régimen (regimen.cambiar): formulario + confirmación.
 * - Descartar aviso (regimen.cambiar; solo con aviso vigente): motivo.
 * - Fijar antigüedad (liquidaciones.aprobar; contrato en borrador o activo).
 * Un solo canal de error, con el foco en él: el de un diálogo queda dentro
 * del diálogo (que sigue abierto); el éxito sale en un toast.
 */
export function RegimenFicha({
  actual,
  puedeCambiar,
  puedeFijarAntiguedad,
}: {
  actual: RegimenActual;
  puedeCambiar: boolean;
  puedeFijarAntiguedad: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [formAbierto, setFormAbierto] = useState(false);
  const [vezFormulario, setVezFormulario] = useState(0);
  const [descartando, setDescartando] = useState(false);
  const [fijando, setFijando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const verDescartar = puedeCambiar && actual.tieneAviso;
  const verAntiguedad =
    puedeFijarAntiguedad && (actual.estadoContrato === "borrador" || actual.estadoContrato === "activo");
  if (!puedeCambiar && !verAntiguedad) return null;

  function abrirFormulario() {
    setVezFormulario((v) => v + 1);
    setFormAbierto(true);
  }

  function abrirDescartar() {
    setError(null);
    setDescartando(true);
  }

  function abrirFijar() {
    setError(null);
    setFijando(true);
  }

  function cerrarDialogo() {
    if (pendiente) return;
    setDescartando(false);
    setFijando(false);
    setError(null);
  }

  function descartar(motivo: string) {
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    startTransition(async () => {
      const r = await descartarAvisoRegimen(actual.contratoId, motivo);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDescartando(false);
      toast.show("Aviso de régimen descartado.", "success");
      router.refresh();
    });
  }

  function fijar(fecha: string | null, motivo: string) {
    setError(null);
    startTransition(async () => {
      const r = await fijarAntiguedad(actual.contratoId, fecha, motivo);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setFijando(false);
      toast.show(`Antigüedad fijada desde ${fechaCorta(r.data)}.`, "success");
      router.refresh();
    });
  }

  const alertaError = error ? <AlertaError title="No se pudo completar la acción">{error}</AlertaError> : null;

  return (
    <div className="flex flex-col gap-4">
      {!formAbierto ? (
        <div className="flex flex-wrap gap-2">
          {puedeCambiar ? (
            <Button onClick={abrirFormulario} icon={<NexoIcon name="pencil" />}>
              {actual.regimen ? "Cambiar régimen" : "Asignar régimen"}
            </Button>
          ) : null}
          {verDescartar ? (
            <Button variant="secondary" onClick={abrirDescartar} disabled={pendiente}>
              Descartar aviso
            </Button>
          ) : null}
          {verAntiguedad ? (
            <Button variant="secondary" onClick={abrirFijar} disabled={pendiente}>
              Fijar antigüedad
            </Button>
          ) : null}
        </div>
      ) : null}

      {formAbierto && puedeCambiar ? (
        <FormularioRegimen
          key={vezFormulario}
          actual={actual}
          onCancelar={() => setFormAbierto(false)}
          onGuardado={() => {
            setFormAbierto(false);
            router.refresh();
          }}
        />
      ) : null}

      <MotivoDialog
        open={descartando}
        title="Descartar aviso de régimen"
        description="El aviso deja de mostrarse en las planillas de este contrato. Queda registrado quién lo descartó y por qué."
        confirmLabel="Descartar aviso"
        pending={pendiente}
        onConfirm={descartar}
        onCancel={cerrarDialogo}
      >
        {alertaError}
      </MotivoDialog>

      {fijando ? (
        <DialogoAntiguedad
          fechaInicio={actual.fechaInicio}
          pendiente={pendiente}
          error={alertaError}
          onConfirmar={fijar}
          onCancelar={cerrarDialogo}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- cambiar o asignar régimen

interface EstadoFormulario {
  regimen: Regimen;
  regimenInss: "integral" | "ivm";
  metodoIr: "retencion_fija" | "exento";
  porcentaje: string;
  pagaVacaciones: boolean;
  pagaAguinaldo: boolean;
  pagaIndemnizacion: boolean;
  vigenteDesde: string;
  motivo: string;
}

interface ErroresFormulario {
  porcentaje?: string;
  vigenteDesde?: string;
  motivo?: string;
}

function formularioInicial(a: RegimenActual): EstadoFormulario {
  const esServicios = a.regimen === "servicios_profesionales";
  const pct = aPorcentaje(a.porcentajeIr);
  return {
    regimen: a.regimen ?? "laboral",
    regimenInss: a.regimenInss === "ivm" ? "ivm" : "integral",
    metodoIr: esServicios && a.metodoIr === "retencion_fija" ? "retencion_fija" : "exento",
    porcentaje: esServicios && pct !== null ? String(pct) : "",
    pagaVacaciones: esServicios ? Boolean(a.pagaVacaciones) : false,
    pagaAguinaldo: esServicios ? Boolean(a.pagaAguinaldo) : false,
    pagaIndemnizacion: esServicios ? Boolean(a.pagaIndemnizacion) : false,
    // Al asignar, el inicio del contrato siempre es una fecha efectiva válida.
    vigenteDesde: a.regimen === null ? (a.fechaInicio ?? "") : "",
    motivo: "",
  };
}

function validar(f: EstadoFormulario, a: RegimenActual): ErroresFormulario {
  const e: ErroresFormulario = {};
  if (f.regimen === "servicios_profesionales" && f.metodoIr === "retencion_fija") {
    const texto = f.porcentaje.trim();
    if (!PORCENTAJE.test(texto) || Number(texto) > 100) {
      e.porcentaje = "Indica un porcentaje de 0 a 100, con hasta 2 decimales.";
    }
  }
  if (!esFechaIso(f.vigenteDesde)) e.vigenteDesde = "Indica la fecha efectiva.";
  else if (a.fechaInicio && f.vigenteDesde < a.fechaInicio) {
    e.vigenteDesde = `La fecha efectiva no puede ser anterior al inicio del contrato (${fechaCorta(a.fechaInicio)}).`;
  }
  const motivo = validarMotivo(f.motivo);
  if (motivo) e.motivo = motivo;
  return e;
}

function aEntrada(f: EstadoFormulario, contratoId: string): CambioRegimenInput {
  const base = { contratoId, vigenteDesde: f.vigenteDesde, motivo: f.motivo.trim() };
  if (f.regimen === "laboral") return { ...base, regimen: "laboral", regimenInss: f.regimenInss };
  return {
    ...base,
    regimen: "servicios_profesionales",
    metodoIr: f.metodoIr,
    porcentajeIr: f.metodoIr === "retencion_fija" ? Number(f.porcentaje.trim()) : null,
    pagaVacaciones: f.pagaVacaciones,
    pagaAguinaldo: f.pagaAguinaldo,
    pagaIndemnizacion: f.pagaIndemnizacion,
  };
}

function FormularioRegimen({
  actual,
  onCancelar,
  onGuardado,
}: {
  actual: RegimenActual;
  onCancelar: () => void;
  onGuardado: () => void;
}) {
  const toast = useToast();
  const id = useId();
  const [f, setF] = useState<EstadoFormulario>(() => formularioInicial(actual));
  const [errores, setErrores] = useState<ErroresFormulario>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const asignar = actual.regimen === null;
  const laboral = f.regimen === "laboral";

  function cambiar<K extends keyof EstadoFormulario>(campo: K, valor: EstadoFormulario[K]) {
    setF((prev) => ({ ...prev, [campo]: valor }));
    if (campo in errores) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  function revisar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nuevos = validar(f, actual);
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    setError(null);
    setConfirmando(true);
  }

  function cancelarConfirmacion() {
    if (pendiente) return;
    setConfirmando(false);
    setError(null);
  }

  function guardar() {
    // Se limpia antes: un error repetido vuelve a montar el aviso y recibe el foco.
    setError(null);
    startTransition(async () => {
      const r = await cambiarRegimen(aEntrada(f, actual.contratoId));
      if (!r.ok) {
        // El diálogo sigue abierto con el mensaje de la RPC.
        setError(r.message);
        return;
      }
      setConfirmando(false);
      toast.show(
        `${asignar ? "Régimen asignado" : "Régimen cambiado"}: rige desde ${fechaCorta(f.vigenteDesde)}.`,
        "success"
      );
      onGuardado();
    });
  }

  const nuevo = {
    regimen: f.regimen,
    regimenInss: laboral ? f.regimenInss : ("ninguno" as const),
    metodoIr: laboral ? ("tabla_progresiva" as const) : f.metodoIr,
    porcentajeIr:
      !laboral && f.metodoIr === "retencion_fija" && PORCENTAJE.test(f.porcentaje.trim())
        ? aFraccion(Number(f.porcentaje.trim()))
        : null,
  };
  const resumen = `${describir(actual)} → ${describir(nuevo)}, desde ${fechaCorta(f.vigenteDesde)}`;

  return (
    <form
      onSubmit={revisar}
      noValidate
      aria-labelledby={`${id}-titulo`}
      className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
    >
      <div>
        <h2 id={`${id}-titulo`} className="text-sm font-semibold text-neutral-900">
          {asignar ? "Asignar régimen" : "Cambiar régimen"}
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          No cambia planillas ya calculadas o aprobadas: aplica desde la fecha efectiva.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={LEYENDA}>Régimen</legend>
        <label className="flex items-start gap-2 text-sm text-neutral-800">
          <input
            type="radio"
            name={`${id}-regimen`}
            className={`${CONTROL} mt-0.5`}
            checked={laboral}
            onChange={() => cambiar("regimen", "laboral")}
            disabled={pendiente}
          />
          <span>
            {REGIMEN.laboral}
            <span className="block text-xs text-neutral-500">INSS, INATEC, IR por tabla y todas las prestaciones.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-neutral-800">
          <input
            type="radio"
            name={`${id}-regimen`}
            className={`${CONTROL} mt-0.5`}
            checked={!laboral}
            onChange={() => cambiar("regimen", "servicios_profesionales")}
            disabled={pendiente}
          />
          <span>
            {REGIMEN.servicios_profesionales}
            <span className="block text-xs text-neutral-500">
              Sin INSS; retención fija de IR o exento; prestaciones según el contrato.
            </span>
          </span>
        </label>
      </fieldset>

      {laboral ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className={LEYENDA}>Régimen INSS</legend>
            {(["integral", "ivm"] as const).map((valor) => (
              <label key={valor} className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="radio"
                  name={`${id}-inss`}
                  className={CONTROL}
                  checked={f.regimenInss === valor}
                  onChange={() => cambiar("regimenInss", valor)}
                  disabled={pendiente}
                />
                {REGIMEN_INSS[valor]}
              </label>
            ))}
            <p className="text-xs text-neutral-500">IVM necesita sus tasas cargadas en Parámetros de ley.</p>
          </fieldset>
          <div className="flex flex-col gap-1">
            <p className={LEYENDA}>IR</p>
            <p className="text-sm text-neutral-800">Tabla progresiva</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className={LEYENDA}>INSS</p>
            <p className="text-sm text-neutral-800">{REGIMEN_INSS.ninguno}</p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className={LEYENDA}>Método de IR</legend>
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                name={`${id}-ir`}
                className={CONTROL}
                checked={f.metodoIr === "retencion_fija"}
                onChange={() => cambiar("metodoIr", "retencion_fija")}
                disabled={pendiente}
              />
              Retención fija
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                name={`${id}-ir`}
                className={CONTROL}
                checked={f.metodoIr === "exento"}
                onChange={() => cambiar("metodoIr", "exento")}
                disabled={pendiente}
              />
              Exento
            </label>
            {f.metodoIr === "retencion_fija" ? (
              <Field label="% de retención" required error={errores.porcentaje} hint="De 0 a 100." className="mt-2 sm:w-40">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.01}
                  value={f.porcentaje}
                  onChange={(e) => cambiar("porcentaje", e.target.value)}
                  disabled={pendiente}
                  required
                />
              </Field>
            ) : null}
          </fieldset>
        </div>
      )}

      <fieldset className="flex flex-col gap-2" aria-describedby={laboral ? `${id}-prestaciones-ayuda` : undefined}>
        <legend className={LEYENDA}>Prestaciones</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(
            [
              ["pagaVacaciones", "Vacaciones"],
              ["pagaAguinaldo", "Aguinaldo"],
              ["pagaIndemnizacion", "Indemnización"],
            ] as const
          ).map(([campo, texto]) => (
            <label key={campo} className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                className={CONTROL}
                checked={laboral ? true : f[campo]}
                onChange={(e) => cambiar(campo, e.target.checked)}
                disabled={laboral || pendiente}
              />
              {texto}
            </label>
          ))}
        </div>
        {laboral ? (
          <p id={`${id}-prestaciones-ayuda`} className="text-xs text-neutral-500">
            El régimen laboral lleva todas las prestaciones.
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Fecha efectiva"
          required
          error={errores.vigenteDesde}
          hint="El inicio del contrato o el día 1 (o 16 en quincenal) de un mes."
        >
          <Input
            type="date"
            value={f.vigenteDesde}
            min={actual.fechaInicio ?? undefined}
            onChange={(e) => cambiar("vigenteDesde", e.target.value)}
            disabled={pendiente}
            required
          />
        </Field>
      </div>

      <Field label="Motivo" required error={errores.motivo} hint={`${f.motivo.length}/${MOTIVO_MAX}`}>
        <Textarea
          rows={3}
          maxLength={MOTIVO_MAX}
          value={f.motivo}
          onChange={(e) => cambiar("motivo", e.target.value)}
          disabled={pendiente}
          required
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onCancelar} disabled={pendiente}>
          Cancelar
        </Button>
        <Button type="submit" loading={pendiente}>
          Revisar y guardar
        </Button>
      </div>

      <ConfirmDialog
        open={confirmando}
        title={asignar ? "Asignar régimen" : "Cambiar régimen"}
        description="No cambia planillas ya calculadas o aprobadas: aplica desde la fecha efectiva."
        confirmLabel={asignar ? "Asignar régimen" : "Guardar cambio"}
        pending={pendiente}
        onConfirm={guardar}
        onCancel={cancelarConfirmacion}
      >
        <div className="flex flex-col gap-3">
          {error ? <AlertaError title="No se pudo guardar el régimen">{error}</AlertaError> : null}
          <p className="text-sm text-neutral-800">{resumen}</p>
        </div>
      </ConfirmDialog>
    </form>
  );
}

// ---------------------------------------------------------------- fijar antigüedad

function DialogoAntiguedad({
  fechaInicio,
  pendiente,
  error,
  onConfirmar,
  onCancelar,
}: {
  fechaInicio: string | null;
  pendiente: boolean;
  /** Error de la acción (AlertaError): se muestra dentro del diálogo, que sigue abierto. */
  error: ReactNode;
  onConfirmar: (fecha: string | null, motivo: string) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [modo, setModo] = useState<"heredar" | "indicar">("heredar");
  const [fecha, setFecha] = useState("");
  const [errorFecha, setErrorFecha] = useState<string | null>(null);

  function confirmar(motivo: string) {
    if (modo === "heredar") {
      onConfirmar(null, motivo);
      return;
    }
    if (!esFechaIso(fecha)) {
      setErrorFecha("Indica la fecha de antigüedad.");
      return;
    }
    if (fechaInicio && fecha > fechaInicio) {
      setErrorFecha(`La antigüedad no puede empezar después del inicio del contrato (${fechaCorta(fechaInicio)}).`);
      return;
    }
    setErrorFecha(null);
    onConfirmar(fecha, motivo);
  }

  return (
    <MotivoDialog
      open
      title="Fijar antigüedad"
      description="La antigüedad decide la indemnización. El tiempo se conserva y las prestaciones se valoran con el salario actual."
      confirmLabel="Fijar antigüedad"
      pending={pendiente}
      onConfirm={confirmar}
      onCancel={onCancelar}
    >
      {error}
      <fieldset className="flex flex-col gap-2">
        <legend className={LEYENDA}>Desde cuándo cuenta</legend>
        <label className="flex items-start gap-2 text-sm text-neutral-800">
          <input
            type="radio"
            name={`${id}-modo`}
            className={`${CONTROL} mt-0.5`}
            checked={modo === "heredar"}
            onChange={() => setModo("heredar")}
            disabled={pendiente}
          />
          <span>
            Heredar del contrato anterior
            <span className="block text-xs text-neutral-500">
              Toma la antigüedad del contrato de la misma persona que terminó el día antes de este.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-neutral-800">
          <input
            type="radio"
            name={`${id}-modo`}
            className={`${CONTROL} mt-0.5`}
            checked={modo === "indicar"}
            onChange={() => setModo("indicar")}
            disabled={pendiente}
          />
          Indicar fecha
        </label>
      </fieldset>
      {modo === "indicar" ? (
        <Field
          label="Fecha de antigüedad"
          required
          error={errorFecha ?? undefined}
          hint={fechaInicio ? `Igual o anterior al inicio del contrato (${fechaCorta(fechaInicio)}).` : undefined}
        >
          <Input
            type="date"
            value={fecha}
            max={fechaInicio ?? undefined}
            onChange={(e) => {
              setFecha(e.target.value);
              if (errorFecha) setErrorFecha(null);
            }}
            disabled={pendiente}
            required
          />
        </Field>
      ) : null}
    </MotivoDialog>
  );
}
