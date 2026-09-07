"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useToast } from "@nexo/ui";
import { crearEmpleado, type CrearEmpleadoResult } from "./actions";

const EMPTY_FORM = {
  nombre: "",
  apellido: "",
  documentoIdentidad: "",
  email: "",
  telefono: "",
};

/**
 * F1.1 (2026-09-07): este formulario crea EXCLUSIVAMENTE el Expediente
 * General de un empleado — nombre, apellido, documento de identidad,
 * correo y telefono. Ya no pide puesto, departamento, modalidad de
 * contrato, salario ni PIN: eso pertenece al Contrato (F1.2), que se
 * crea despues, sobre este mismo empleado, desde su ficha. "Crear
 * empleado != contratar empleado" (docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md).
 *
 * Nexo Enterprise UI (2026-09-07): feedback idle→loading→success/error via
 * useToast (regla obligatoria §1.10) ademas del panel de exito existente.
 */
export default function NuevoEmpleadoForm() {
  const { show } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrearEmpleadoResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearEmpleado({
        nombre: form.nombre,
        apellido: form.apellido,
        documentoIdentidad: form.documentoIdentidad || undefined,
        email: form.email || undefined,
        telefono: form.telefono || undefined,
      });

      if (!res.ok) {
        setError(res.message ?? "No se pudo crear el empleado.");
        show(res.message ?? "No se pudo crear el empleado.", "error");
        return;
      }
      show("Expediente creado correctamente.", "success");
      setResult(res);
    });
  }

  if (result?.ok) {
    return <ExpedienteCreadoPanel result={result} onNuevo={() => { setResult(null); setForm(EMPTY_FORM); }} />;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombres" required>
          <input
            required
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            className={inputClass}
            placeholder="Julio César"
          />
        </Field>
        <Field label="Apellidos" required>
          <input
            required
            value={form.apellido}
            onChange={(e) => update("apellido", e.target.value)}
            className={inputClass}
            placeholder="Castillo Canales"
          />
        </Field>
        <Field label="Documento de identidad">
          <input
            value={form.documentoIdentidad}
            onChange={(e) => update("documentoIdentidad", e.target.value)}
            className={inputClass}
            placeholder="opcional"
          />
        </Field>
        <Field label="Correo">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
            placeholder="opcional"
          />
        </Field>
        <Field label="Teléfono">
          <input
            value={form.telefono}
            onChange={(e) => update("telefono", e.target.value)}
            className={inputClass}
            placeholder="opcional"
          />
        </Field>
      </div>

      <p className="text-xs text-neutral-400">
        Este formulario solo crea el expediente general. Puesto,
        departamento, salario y PIN de asistencia se asignan al crear un
        contrato para este empleado, desde su ficha.
      </p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Creando…" : "Crear empleado"}
        </button>
        <Link href="/expedientes" className="text-sm text-neutral-500 hover:text-neutral-900">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-500">
        {label}
        {required && <span className="text-blue-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

function ExpedienteCreadoPanel({
  result,
  onNuevo,
}: {
  result: CrearEmpleadoResult;
  onNuevo: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-200 bg-white p-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
        ✓
      </span>
      <div>
        <p className="text-lg font-semibold text-neutral-900">Expediente creado</p>
        <p className="text-sm text-neutral-500">
          Código <span className="font-mono text-neutral-700">#{result.codigoEmpleado}</span>
        </p>
      </div>

      <p className="max-w-sm rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Todavía no tiene contrato ni PIN de asistencia. Para habilitarlo a
        trabajar, creá un contrato desde su ficha y activalo — el PIN se
        genera automáticamente en ese momento.
      </p>

      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={onNuevo}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Crear otro empleado
        </button>
        <Link href="/expedientes" className="text-sm text-neutral-500 hover:text-neutral-900">
          Volver al listado
        </Link>
      </div>
    </div>
  );
}
