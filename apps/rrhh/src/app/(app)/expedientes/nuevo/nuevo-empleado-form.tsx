"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
 */
export default function NuevoEmpleadoForm() {
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
        return;
      }
      setResult(res);
    });
  }

  if (result?.ok) {
    return <ExpedienteCreadoPanel result={result} onNuevo={() => { setResult(null); setForm(EMPTY_FORM); }} />;
  }

  return (
    <form onSubmit={submit} className="nexo-glass flex flex-col gap-5 rounded-2xl p-6">
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

      <p className="text-xs text-white/40">
        Este formulario solo crea el expediente general. Puesto,
        departamento, salario y PIN de asistencia se asignan al crear un
        contrato para este empleado, desde su ficha.
      </p>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[var(--nexo-accent)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--nexo-accent-hover)] disabled:opacity-50"
        >
          {isPending ? "Creando…" : "Crear empleado"}
        </button>
        <Link href="/expedientes" className="text-sm text-white/50 hover:text-white">
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
      <span className="text-white/60">
        {label}
        {required && <span className="text-[var(--nexo-accent-hover)]"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-[var(--nexo-border)] bg-black/20 px-3 py-2 text-white placeholder:text-white/30 outline-none focus:border-[var(--nexo-accent)]";

function ExpedienteCreadoPanel({
  result,
  onNuevo,
}: {
  result: CrearEmpleadoResult;
  onNuevo: () => void;
}) {
  return (
    <div className="nexo-glass flex flex-col items-center gap-4 rounded-2xl p-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-400">
        ✓
      </span>
      <div>
        <p className="text-lg font-semibold text-white">Expediente creado</p>
        <p className="text-sm text-white/50">
          Código <span className="font-mono text-white/80">#{result.codigoEmpleado}</span>
        </p>
      </div>

      <p className="max-w-sm rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
        Todavía no tiene contrato ni PIN de asistencia. Para habilitarlo a
        trabajar, creá un contrato desde su ficha y activalo — el PIN se
        genera automáticamente en ese momento.
      </p>

      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={onNuevo}
          className="rounded-lg bg-[var(--nexo-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--nexo-accent-hover)]"
        >
          Crear otro empleado
        </button>
        <Link href="/expedientes" className="text-sm text-white/50 hover:text-white">
          Volver al listado
        </Link>
      </div>
    </div>
  );
}
