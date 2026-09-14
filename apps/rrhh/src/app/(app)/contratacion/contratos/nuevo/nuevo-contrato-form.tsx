"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@nexo/ui";
import { crearContrato, type ContratoInput } from "../actions";

export interface EmpleadoOption {
  id: string;
  nombreCompleto: string;
  codigoEmpleado: number;
  documentoIdentidad: string | null;
  /** Ya tiene un contrato activo o en borrador — crear otro lo duplicaría. */
  tieneContratoAbierto: boolean;
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "text-sm text-neutral-500";

const EMPTY_FORM: ContratoInput = {
  puesto: "",
  departamento: "",
  modalidadContrato: "nomina_estandar",
  fechaInicio: "",
  fechaFinPrevista: "",
  salarioBase: undefined,
};

/**
 * Búsqueda simple (filtro client-side sobre la lista ya cargada — no hace
 * falta una nueva RPC de búsqueda para el tamaño real de plantilla de la
 * empresa) + selección de empleado, seguida del mismo formulario de datos
 * base de contrato que antes vivía en el expediente (ContratosPanel).
 */
export default function NuevoContratoForm({
  empleados,
  canEditarSalario,
}: {
  empleados: EmpleadoOption[];
  canEditarSalario: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [empleadoId, setEmpleadoId] = useState<string>("");
  const [form, setForm] = useState<ContratoInput>(EMPTY_FORM);
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

  function update<K extends keyof ContratoInput>(key: K, value: ContratoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!empleadoId) {
      setError("Elegí un empleado.");
      return;
    }
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
          size={Math.min(8, Math.max(4, filtrados.length))}
          className={`${inputClass} h-auto`}
        >
          {filtrados.length === 0 && <option disabled>Sin resultados</option>}
          {filtrados.map((e) => (
            <option key={e.id} value={e.id} disabled={e.tieneContratoAbierto}>
              {e.nombreCompleto} — #{e.codigoEmpleado}
              {e.documentoIdentidad ? ` · ${e.documentoIdentidad}` : ""}
              {e.tieneContratoAbierto ? " (ya tiene un contrato activo/borrador)" : ""}
            </option>
          ))}
        </select>
        {seleccionado?.tieneContratoAbierto && (
          <p className="text-xs text-amber-600">
            Este empleado ya tiene un contrato activo o en borrador — no se puede crear otro. Buscalo
            en el listado de Contratos.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Datos del contrato</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Puesto">
            <input value={form.puesto} onChange={(e) => update("puesto", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Departamento">
            <input
              value={form.departamento}
              onChange={(e) => update("departamento", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Modalidad">
            <select
              value={form.modalidadContrato}
              onChange={(e) => update("modalidadContrato", e.target.value as ContratoInput["modalidadContrato"])}
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
          <Field label="Fecha fin prevista">
            <input
              type="date"
              value={form.fechaFinPrevista}
              onChange={(e) => update("fechaFinPrevista", e.target.value)}
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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !empleadoId || seleccionado?.tieneContratoAbierto}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creando…" : "Crear borrador"}
        </button>
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
