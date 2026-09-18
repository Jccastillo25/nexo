"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@nexo/ui";
import { crearContrato, type CrearContratoInput } from "../actions";

export interface EmpleadoOption {
  id: string;
  nombreCompleto: string;
  codigoEmpleado: number;
  documentoIdentidad: string | null;
  /** Id del contrato activo/borrador existente, si lo tiene — permite
   * enlazarlo directo en vez de solo avisar que existe. */
  contratoAbiertoId: string | null;
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

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400";
const labelClass = "text-sm text-neutral-500";

const EMPTY_FORM: CrearContratoInput = {
  puestoId: "",
  departamentoId: "",
  plantillaContratoId: "",
  modalidadContrato: "nomina_estandar",
  fechaInicio: "",
  salarioBase: undefined,
};

/**
 * Búsqueda simple (filtro client-side sobre la lista ya cargada — no hace
 * falta una nueva RPC de búsqueda para el tamaño real de plantilla de la
 * empresa) + selección de empleado, seguida del mismo formulario de datos
 * base de contrato que antes vivía en el expediente (ContratosPanel).
 *
 * 2026-09-17 (auditoría del botón "Crear borrador" deshabilitado): la
 * causa real no era de negocio — el `<select>` de empleados no tenía una
 * opción con `value=""`, así que cuando nada estaba elegido el navegador
 * resaltaba visualmente el PRIMER empleado de la lista (comportamiento
 * nativo de un `<select>` controlado sin opción vacía) mientras el estado
 * de React (`empleadoId`) seguía en `""` — el usuario veía "un empleado
 * elegido" pero el botón seguía deshabilitado por `!empleadoId`, sin
 * ningún mensaje visible que lo explicara. Se agrega la opción vacía
 * explícita de abajo y un banner de motivo siempre visible junto al botón.
 *
 * Reglas de negocio nuevas (2026-09-17, ver
 * supabase/migrations/20260917100000_...): puesto/departamento/plantilla
 * son obligatorios; el departamento se elige primero y filtra los puestos
 * disponibles; la plantilla se filtra por las asignadas a ese puesto
 * (rrhh.puesto_plantillas) y se pre-selecciona la predeterminada si existe;
 * sin "Fecha fin prevista" en este formulario (rrhh.fn_crear_contrato ya
 * no acepta ese parámetro).
 */
export default function NuevoContratoForm({
  empleados,
  puestos,
  departamentos,
  plantillas,
  puestoPlantillas,
  canEditarSalario,
}: {
  empleados: EmpleadoOption[];
  puestos: PuestoOption[];
  departamentos: DepartamentoOption[];
  plantillas: PlantillaOption[];
  puestoPlantillas: PuestoPlantillaOption[];
  canEditarSalario: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [form, setForm] = useState<CrearContratoInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter(
      (e) =>
        e.nombreCompleto.toLowerCase().includes(q) ||
        String(e.codigoEmpleado).includes(q) ||
        (e.documentoIdentidad ?? "").toLowerCase().includes(q)
    );
  }, [empleados, query]);

  const seleccionado = empleados.find((e) => e.id === empleadoId) ?? null;

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

  function update<K extends keyof CrearContratoInput>(key: K, value: CrearContratoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Departamento cambia → limpiar puesto si ya no pertenece a él (y su
  // plantilla, que depende del puesto). Puesto cambia → pre-seleccionar la
  // plantilla predeterminada de ese puesto si tiene una, o limpiarla si no
  // pertenece más al puesto elegido.
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
    const predeterminada = puestoPlantillas.find((pp) => pp.puestoId === puestoId && pp.predeterminada);
    setForm((f) => ({ ...f, puestoId, plantillaContratoId: predeterminada?.plantillaId ?? "" }));
  }

  // Motivo de bloqueo del boton, en orden de prioridad — siempre visible
  // cuando el boton esta deshabilitado, nunca una razon adivinada por el
  // usuario. Enlaza al contrato existente cuando lo hay.
  const motivo: { texto: string; href?: string } | null = useMemo(() => {
    if (isPending) return { texto: "Guardando…" };
    if (!empleadoId) return { texto: "Elegí un empleado de la lista para continuar." };
    if (seleccionado?.contratoAbiertoId) {
      return {
        texto: "Este empleado ya tiene un contrato activo o en borrador.",
        href: `/contratacion/contratos/${seleccionado.contratoAbiertoId}`,
      };
    }
    if (!form.departamentoId) return { texto: "Elegí un departamento." };
    if (!form.puestoId) {
      return puestosDelDepartamento.length === 0
        ? { texto: "Este departamento no tiene puestos activos — creá uno en Catálogos → Puestos." }
        : { texto: "Elegí un puesto de ese departamento." };
    }
    if (!form.plantillaContratoId) {
      return plantillasDelPuesto.length === 0
        ? {
            texto:
              "Este puesto no tiene ninguna plantilla de contrato asignada — asigná una en Catálogos → Puestos.",
          }
        : { texto: "Elegí una plantilla de contrato." };
    }
    return null;
  }, [isPending, empleadoId, seleccionado, form, puestosDelDepartamento.length, plantillasDelPuesto.length]);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (motivo) return;
    setError(null);
    startTransition(async () => {
      const res = await crearContrato(empleadoId, form);
      if (!res.ok || !res.contratoId) {
        setError(res.message ?? "No se pudo crear el contrato.");
        show(res.message ?? "No se pudo crear el contrato.", "error");
        return;
      }
      show("Contrato creado en borrador.", "success");
      router.push(`/contratacion/contratos/${res.contratoId}`);
    });
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Empleado</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, código o documento…"
          className={inputClass}
        />
        <select
          value={empleadoId}
          onChange={(e) => setEmpleadoId(e.target.value)}
          size={Math.min(8, Math.max(4, filtrados.length + 1))}
          className={`${inputClass} h-auto`}
        >
          <option value="">— Elegí un empleado —</option>
          {filtrados.length === 0 && <option disabled>Sin resultados</option>}
          {filtrados.map((e) => (
            <option key={e.id} value={e.id} disabled={!!e.contratoAbiertoId}>
              {e.nombreCompleto} — #{e.codigoEmpleado}
              {e.documentoIdentidad ? ` · ${e.documentoIdentidad}` : ""}
              {e.contratoAbiertoId ? " (ya tiene un contrato activo/borrador)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Datos del contrato</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Departamento">
            <select
              value={form.departamentoId}
              onChange={(e) => cambiarDepartamento(e.target.value)}
              className={inputClass}
            >
              <option value="">— Elegí un departamento —</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
            {departamentos.length === 0 && (
              <p className="text-xs text-neutral-400">
                Sin departamentos creados todavía — ver Contratación → Catálogos → Departamentos.
              </p>
            )}
          </Field>
          <Field label="Puesto">
            <select
              value={form.puestoId}
              onChange={(e) => cambiarPuesto(e.target.value)}
              disabled={!form.departamentoId}
              className={inputClass}
            >
              <option value="">
                {form.departamentoId ? "— Elegí un puesto —" : "Elegí primero un departamento"}
              </option>
              {puestosDelDepartamento.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {form.departamentoId && puestosDelDepartamento.length === 0 && (
              <p className="text-xs text-neutral-400">
                Este departamento no tiene puestos activos todavía.
              </p>
            )}
          </Field>
          <Field label="Plantilla de contrato">
            <select
              value={form.plantillaContratoId}
              onChange={(e) => update("plantillaContratoId", e.target.value)}
              disabled={!form.puestoId}
              className={inputClass}
            >
              <option value="">
                {form.puestoId ? "— Elegí una plantilla —" : "Elegí primero un puesto"}
              </option>
              {plantillasDelPuesto.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {form.puestoId && plantillasDelPuesto.length === 0 && (
              <p className="text-xs text-neutral-400">
                Sin plantillas asignadas a este puesto — ver Contratación → Catálogos → Puestos.
              </p>
            )}
          </Field>
          <Field label="Modalidad">
            <select
              value={form.modalidadContrato}
              onChange={(e) => update("modalidadContrato", e.target.value as CrearContratoInput["modalidadContrato"])}
              className={inputClass}
            >
              <option value="nomina_estandar">Nómina estándar</option>
              <option value="comisionista_destajo">Comisionista / destajo</option>
            </select>
          </Field>
          <Field label="Fecha de inicio">
            <input
              type="date"
              value={form.fechaInicio}
              onChange={(e) => update("fechaInicio", e.target.value)}
              className={inputClass}
            />
          </Field>
          {canEditarSalario && (
            <Field label="Salario base">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.salarioBase ?? ""}
                onChange={(e) => update("salarioBase", e.target.value ? Number(e.target.value) : undefined)}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-col items-start gap-2">
        <button
          type="submit"
          disabled={!!motivo}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creando…" : "Crear borrador"}
        </button>
        {motivo && (
          <p className="text-xs text-amber-600">
            {motivo.texto}
            {motivo.href && (
              <>
                {" "}
                <Link href={motivo.href} className="font-medium underline hover:text-amber-700">
                  Ver ese contrato
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
