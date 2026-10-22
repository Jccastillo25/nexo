"use client";

// Ficha de UN contrato (Contratación → Contratos → fila) — dueña única del
// ciclo de vida completo del contrato (P2/P3, reconciliación de
// navegación 2026-09-14): editar datos base, asignar jornada, activar
// (genera PIN), regenerar PIN, finalizar. Reutiliza exactamente las mismas
// Server Actions/RPC (contratacion/contratos/actions.ts), cada una con su
// requirePermission en el servidor.
//
// 2026-10-20 (Nexo Enterprise UI v2): campos y botones del kit, fechas y
// montos con @nexo/ui/formato, estado de la credencial con StatusBadge y
// confirmación antes de Finalizar (irreversible, revoca el PIN) y antes de
// Regenerar PIN (el actual deja de funcionar). El estado del contrato se
// muestra en el encabezado de la página (PageHeader → meta).
import { useId, useMemo, useState, useTransition } from "react";
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  Input,
  NexoIcon,
  Select,
  StatusBadge,
  SubmitButton,
  fechaCorta,
  moneda,
  useToast,
  type StatusTone,
} from "@nexo/ui";
import type { EstadoContrato } from "@/lib/contratos";
import {
  editarContrato,
  activarContrato,
  finalizarContrato,
  regenerarPin,
  asignarJornada,
  type ContratoInput,
} from "../actions";

export interface ContratoFichaData {
  id: string;
  numeroContrato: number;
  estado: EstadoContrato;
  puestoId: string | null;
  puestoNombre: string | null;
  departamentoId: string | null;
  departamentoNombre: string | null;
  plantillaContratoId: string | null;
  plantillaNombre: string | null;
  modalidadContrato: "nomina_estandar" | "comisionista_destajo" | null;
  fechaInicio: string | null;
  fechaFinPrevista: string | null;
  fechaFinReal: string | null;
  salarioBase: number | null;
}

export interface PuestoOption {
  id: string;
  nombre: string;
  departamentoId: string | null;
}

export interface DepartamentoOption {
  id: string;
  nombre: string;
}

export interface PlantillaOption {
  id: string;
  nombre: string;
}

export interface PuestoPlantillaOption {
  puestoId: string;
  plantillaId: string;
  predeterminada: boolean;
}

export interface CredencialEstado {
  tieneCredencial: boolean;
  activo: boolean;
  pinBloqueado: boolean;
  rotacionNumero: number;
}

export interface JornadaOption {
  id: string;
  nombre: string;
}

export interface JornadaVigente {
  jornadaNombre: string;
  vigenteDesde: string;
}

const MODALIDAD_LABEL: Record<NonNullable<ContratoFichaData["modalidadContrato"]>, string> = {
  nomina_estandar: "Nómina estándar",
  comisionista_destajo: "Comisionista / destajo",
};

function estadoCredencial(c: CredencialEstado): { label: string; tone: StatusTone } {
  if (!c.tieneCredencial) return { label: "Sin generar", tone: "warning" };
  if (c.pinBloqueado) return { label: "Bloqueada", tone: "negative" };
  if (c.activo) return { label: `Activa · rotación ${c.rotacionNumero}`, tone: "positive" };
  return { label: "Revocada", tone: "neutral" };
}

type Confirmacion = "finalizar" | "regenerar" | null;

export default function ContratoFicha({
  contrato,
  canEditar,
  canActivar,
  canFinalizar,
  canVerSalario,
  canEditarSalario,
  canVerCredenciales,
  canRegenerarPin,
  canVerTurnos,
  credencial,
  jornadasDisponibles,
  jornadaVigente,
  puestos,
  departamentos,
  plantillas,
  puestoPlantillas,
}: {
  contrato: ContratoFichaData;
  canEditar: boolean;
  canActivar: boolean;
  canFinalizar: boolean;
  canVerSalario: boolean;
  canEditarSalario: boolean;
  canVerCredenciales: boolean;
  canRegenerarPin: boolean;
  canVerTurnos: boolean;
  credencial: CredencialEstado | null;
  jornadasDisponibles: JornadaOption[];
  jornadaVigente: JornadaVigente | null;
  puestos: PuestoOption[];
  departamentos: DepartamentoOption[];
  plantillas: PlantillaOption[];
  puestoPlantillas: PuestoPlantillaOption[];
}) {
  const { show } = useToast();
  const motivoActivarId = useId();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<ContratoInput>({
    puestoId: contrato.puestoId ?? "",
    departamentoId: contrato.departamentoId ?? "",
    plantillaContratoId: contrato.plantillaContratoId ?? "",
    modalidadContrato: contrato.modalidadContrato ?? "nomina_estandar",
    fechaInicio: contrato.fechaInicio ?? "",
    fechaFinPrevista: contrato.fechaFinPrevista ?? "",
    salarioBase: contrato.salarioBase ?? undefined,
  });
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pinRevelado, setPinRevelado] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null);
  const [activando, setActivando] = useState(false);
  const [isPending, startTransition] = useTransition();

  const puestosDelDepartamento = useMemo(
    () => puestos.filter((p) => p.departamentoId === form.departamentoId),
    [puestos, form.departamentoId]
  );
  const plantillasDelPuesto = useMemo(() => {
    if (!form.puestoId) return [];
    const idsAsignados = new Set(
      puestoPlantillas.filter((pp) => pp.puestoId === form.puestoId).map((pp) => pp.plantillaId)
    );
    return plantillas.filter((p) => idsAsignados.has(p.id));
  }, [plantillas, puestoPlantillas, form.puestoId]);

  function cambiarDepartamento(departamentoId: string) {
    setForm((f) => {
      const puestoSigueValido = puestos.some(
        (p) => p.id === f.puestoId && p.departamentoId === departamentoId
      );
      return {
        ...f,
        departamentoId,
        puestoId: puestoSigueValido ? f.puestoId : "",
        plantillaContratoId: puestoSigueValido ? f.plantillaContratoId : "",
      };
    });
  }

  function cambiarPuesto(puestoId: string) {
    setForm((f) => {
      const siguePerteneciendo = puestoPlantillas.some(
        (pp) => pp.puestoId === puestoId && pp.plantillaId === f.plantillaContratoId
      );
      return { ...f, puestoId, plantillaContratoId: siguePerteneciendo ? f.plantillaContratoId : "" };
    });
  }

  const puedeEditar = canEditar && contrato.estado === "borrador";
  const puedeAsignarJornada = canEditar && canVerTurnos && contrato.estado !== "finalizado";
  const puedeActivar = contrato.estado === "borrador" && canActivar;
  const puedeRegenerar = contrato.estado === "activo" && canRegenerarPin;
  const puedeFinalizar = contrato.estado === "activo" && canFinalizar;

  function update<K extends keyof ContratoInput>(key: K, value: ContratoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await editarContrato(contrato.id, form);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar el contrato.");
        show(res.message ?? "No se pudo guardar el contrato.", "error");
        return;
      }
      show("Contrato actualizado.", "success");
      setEditando(false);
    });
  }

  function asignar() {
    if (!jornadaSeleccionada) return;
    setError(null);
    startTransition(async () => {
      const res = await asignarJornada(contrato.id, jornadaSeleccionada);
      if (!res.ok) {
        setError(res.message ?? "No se pudo asignar la jornada.");
        show(res.message ?? "No se pudo asignar la jornada.", "error");
        return;
      }
      show("Jornada asignada.", "success");
      setJornadaSeleccionada("");
    });
  }

  function activar() {
    setError(null);
    setActivando(true);
    startTransition(async () => {
      try {
        const res = await activarContrato(contrato.id);
        if (!res.ok) {
          setError(res.message ?? "No se pudo activar el contrato.");
          show(res.message ?? "No se pudo activar el contrato.", "error");
          return;
        }
        show("Contrato activado.", "success");
        if (res.pin) setPinRevelado(res.pin);
      } finally {
        setActivando(false);
      }
    });
  }

  function regenerar() {
    setError(null);
    startTransition(async () => {
      const res = await regenerarPin(contrato.id);
      setConfirmacion(null);
      if (!res.ok) {
        setError(res.message ?? "No se pudo regenerar el PIN.");
        show(res.message ?? "No se pudo regenerar el PIN.", "error");
        return;
      }
      show("PIN regenerado.", "success");
      if (res.pin) setPinRevelado(res.pin);
    });
  }

  function finalizar() {
    setError(null);
    startTransition(async () => {
      const res = await finalizarContrato(contrato.id);
      setConfirmacion(null);
      if (!res.ok) {
        setError(res.message ?? "No se pudo finalizar el contrato.");
        show(res.message ?? "No se pudo finalizar el contrato.", "error");
        return;
      }
      show("Contrato finalizado. La credencial de asistencia quedó revocada.", "success");
    });
  }

  const credencialVisible = contrato.estado === "activo" && canVerCredenciales && credencial;
  const estadoCred = credencial ? estadoCredencial(credencial) : null;

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {pinRevelado ? (
        <div
          role="status"
          className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-6 py-4 text-center"
        >
          <p className="text-xs font-medium text-neutral-600">PIN del kiosco: se muestra una sola vez</p>
          <p className="text-4xl font-bold tabular-nums tracking-[0.3em] text-neutral-900">{pinRevelado}</p>
          <p className="mt-1 text-xs text-neutral-600">
            Anótalo o entrégalo ahora al empleado: no se puede volver a ver, solo regenerar.
          </p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPinRevelado(null)}>
            Ocultar PIN
          </Button>
        </div>
      ) : null}

      <section
        aria-labelledby="contrato-datos"
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
      >
        <h2 id="contrato-datos" className="text-sm font-semibold text-neutral-900">
          Datos del contrato
        </h2>

        {editando ? (
          <form onSubmit={guardar} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Departamento">
                <Select value={form.departamentoId} onChange={(e) => cambiarDepartamento(e.target.value)}>
                  <option value="">Elige un departamento</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Puesto">
                <Select
                  value={form.puestoId}
                  onChange={(e) => cambiarPuesto(e.target.value)}
                  disabled={!form.departamentoId}
                >
                  <option value="">
                    {form.departamentoId ? "Elige un puesto" : "Elige primero un departamento"}
                  </option>
                  {puestosDelDepartamento.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Plantilla de contrato"
                hint={
                  form.puestoId && plantillasDelPuesto.length === 0
                    ? "Este puesto no tiene plantillas asignadas."
                    : undefined
                }
              >
                <Select
                  value={form.plantillaContratoId}
                  onChange={(e) => update("plantillaContratoId", e.target.value)}
                  disabled={!form.puestoId}
                >
                  <option value="">{form.puestoId ? "Elige una plantilla" : "Elige primero un puesto"}</option>
                  {plantillasDelPuesto.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Modalidad">
                <Select
                  value={form.modalidadContrato}
                  onChange={(e) =>
                    update("modalidadContrato", e.target.value as ContratoInput["modalidadContrato"])
                  }
                >
                  <option value="nomina_estandar">Nómina estándar</option>
                  <option value="comisionista_destajo">Comisionista / destajo</option>
                </Select>
              </Field>
              <Field label="Fecha de inicio">
                <Input
                  type="date"
                  value={form.fechaInicio}
                  onChange={(e) => update("fechaInicio", e.target.value)}
                />
              </Field>
              <Field label="Fin previsto" optional>
                <Input
                  type="date"
                  value={form.fechaFinPrevista}
                  onChange={(e) => update("fechaFinPrevista", e.target.value)}
                />
              </Field>
              {canEditarSalario ? (
                <Field label="Salario base (C$)">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={form.salarioBase ?? ""}
                    onChange={(e) =>
                      update("salarioBase", e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </Field>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setEditando(false)} disabled={isPending}>
                Cancelar
              </Button>
              <SubmitButton loading={isPending} pendingLabel="Guardando…">
                Guardar cambios
              </SubmitButton>
            </div>
          </form>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Dato label="Puesto" value={contrato.puestoNombre ?? "—"} />
              <Dato label="Departamento" value={contrato.departamentoNombre ?? "—"} />
              <Dato label="Plantilla de contrato" value={contrato.plantillaNombre ?? "—"} />
              <Dato
                label="Modalidad"
                value={contrato.modalidadContrato ? MODALIDAD_LABEL[contrato.modalidadContrato] : "—"}
              />
              <Dato label="Inicio" value={fechaCorta(contrato.fechaInicio)} />
              <Dato label="Fin previsto" value={fechaCorta(contrato.fechaFinPrevista)} />
              {contrato.fechaFinReal ? <Dato label="Fin real" value={fechaCorta(contrato.fechaFinReal)} /> : null}
              {canVerSalario ? <Dato label="Salario base" value={moneda(contrato.salarioBase, "NIO")} /> : null}
            </dl>

            {credencialVisible && estadoCred ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                <span>Credencial de asistencia:</span>
                <StatusBadge label={estadoCred.label} tone={estadoCred.tone} />
              </div>
            ) : null}

            {puedeEditar || puedeActivar || puedeRegenerar || puedeFinalizar ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {puedeEditar ? (
                    <Button variant="secondary" onClick={() => setEditando(true)} disabled={isPending}>
                      Editar contrato
                    </Button>
                  ) : null}
                  {puedeRegenerar ? (
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmacion("regenerar")}
                      disabled={isPending}
                      icon={<NexoIcon name="refresh" />}
                    >
                      Regenerar PIN
                    </Button>
                  ) : null}
                  {puedeFinalizar ? (
                    <Button
                      variant="destructive-outline"
                      onClick={() => setConfirmacion("finalizar")}
                      disabled={isPending}
                    >
                      Finalizar contrato
                    </Button>
                  ) : null}
                  {puedeActivar ? (
                    <Button
                      onClick={activar}
                      loading={activando}
                      disabled={!jornadaVigente || isPending}
                      aria-describedby={!jornadaVigente ? motivoActivarId : undefined}
                    >
                      Activar contrato
                    </Button>
                  ) : null}
                </div>
                {puedeActivar && !jornadaVigente ? (
                  <p id={motivoActivarId} className="text-xs text-amber-700">
                    Para activar el contrato, primero asígnale una jornada.
                  </p>
                ) : null}
              </div>
            ) : null}

            {!puedeEditar && contrato.estado === "borrador" ? (
              <p className="text-xs text-neutral-500">No tienes permiso para editar este contrato.</p>
            ) : null}
            {contrato.estado !== "borrador" ? (
              <p className="text-xs text-neutral-500">
                Solo se puede editar un contrato en borrador: la información base queda fija al activarlo.
              </p>
            ) : null}
          </>
        )}
      </section>

      {puedeAsignarJornada ? (
        <section
          aria-labelledby="contrato-jornada"
          className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
        >
          <h2 id="contrato-jornada" className="text-sm font-semibold text-neutral-900">
            Jornada
          </h2>
          {jornadaVigente ? (
            <p className="text-sm text-neutral-700">
              {jornadaVigente.jornadaNombre}
              <span className="ml-1 text-neutral-500">(vigente desde {fechaCorta(jornadaVigente.vigenteDesde)})</span>
            </p>
          ) : (
            <p className="text-sm text-amber-700">Sin jornada asignada: no se puede activar el contrato.</p>
          )}
          {jornadasDisponibles.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label={jornadaVigente ? "Cambiar jornada" : "Asignar jornada"} className="sm:w-72">
                <Select value={jornadaSeleccionada} onChange={(e) => setJornadaSeleccionada(e.target.value)}>
                  <option value="">Elige una jornada</option>
                  {jornadasDisponibles.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <div>
                <Button variant="secondary" disabled={isPending || !jornadaSeleccionada} onClick={asignar}>
                  {jornadaVigente ? "Cambiar jornada" : "Asignar jornada"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              Todavía no hay jornadas creadas. Créalas en Contratación → Jornadas.
            </p>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmacion === "finalizar"}
        title="Finalizar contrato"
        description="El contrato pasa a Finalizado y el PIN de asistencia del empleado deja de funcionar de inmediato. Esta acción no se puede deshacer."
        confirmLabel="Finalizar contrato"
        destructive
        pending={isPending}
        onConfirm={finalizar}
        onCancel={() => setConfirmacion(null)}
      />
      <ConfirmDialog
        open={confirmacion === "regenerar"}
        title="Regenerar PIN"
        description="Se genera un PIN nuevo y el actual deja de funcionar de inmediato. El nuevo se muestra una sola vez."
        confirmLabel="Regenerar PIN"
        pending={isPending}
        onConfirm={regenerar}
        onCancel={() => setConfirmacion(null)}
      />
    </div>
  );
}

/** Dato de solo lectura (no confundir con el Field de formulario del kit). */
function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="break-words text-sm text-neutral-900 tabular-nums">{value}</dd>
    </div>
  );
}
