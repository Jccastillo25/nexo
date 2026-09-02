"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { crearEmpleado, type CrearEmpleadoResult } from "./actions";

type ModalidadContrato = "nomina_estandar" | "comisionista_destajo";

const EMPTY_FORM = {
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  puesto: "",
  departamento: "",
  modalidadContrato: "nomina_estandar" as ModalidadContrato,
  salarioBase: "",
};

export default function NuevoEmpleadoForm({
  canEditarCompensacion,
}: {
  canEditarCompensacion: boolean;
}) {
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
        email: form.email || undefined,
        telefono: form.telefono || undefined,
        puesto: form.puesto || undefined,
        departamento: form.departamento || undefined,
        // Solo se mandan si el formulario los muestra — sin
        // rrhh.expedientes.compensacion.editar, el RPC los rechaza igual
        // (ver actions.ts), esto solo evita el viaje al servidor con
        // datos que de todas formas no van a pasar.
        modalidadContrato: canEditarCompensacion ? form.modalidadContrato : undefined,
        salarioBase:
          canEditarCompensacion && form.salarioBase
            ? Number(form.salarioBase)
            : undefined,
      });

      if (!res.ok) {
        setError(res.message ?? "No se pudo crear el empleado.");
        return;
      }
      setResult(res);
    });
  }

  if (result?.ok) {
    return <CredencialesPanel result={result} onNuevo={() => { setResult(null); setForm(EMPTY_FORM); }} />;
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
        <Field label="Puesto">
          <input
            value={form.puesto}
            onChange={(e) => update("puesto", e.target.value)}
            className={inputClass}
            placeholder="opcional"
          />
        </Field>
        <Field label="Departamento">
          <input
            value={form.departamento}
            onChange={(e) => update("departamento", e.target.value)}
            className={inputClass}
            placeholder="opcional"
          />
        </Field>
      </div>

      {/* Campos de compensacion — solo visibles con
          rrhh.expedientes.compensacion.editar (regla obligatoria de
          permisos, paso 4: ocultar el control cuando hasPermission es
          false). El chequeo real esta en el servidor (fn_crear_empleado). */}
      {canEditarCompensacion && (
        <div className="grid grid-cols-1 gap-4 border-t border-[var(--nexo-border)] pt-4 sm:grid-cols-2">
          <Field label="Modalidad de contrato" required>
            <select
              value={form.modalidadContrato}
              onChange={(e) =>
                update("modalidadContrato", e.target.value as ModalidadContrato)
              }
              className={inputClass}
            >
              <option value="nomina_estandar">Nómina estándar</option>
              <option value="comisionista_destajo">Comisionista / destajo</option>
            </select>
          </Field>
          <Field label="Salario base">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.salarioBase}
              onChange={(e) => update("salarioBase", e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </Field>
        </div>
      )}

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

function CredencialesPanel({
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
        <p className="text-lg font-semibold text-white">Empleado creado</p>
        <p className="text-sm text-white/50">
          Usuario <span className="font-mono text-white/80">{result.nombreUsuario}</span>
        </p>
      </div>

      {result.credencialesOcultas ? (
        <p className="max-w-sm rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          El PIN no se muestra acá porque tu cuenta no tiene el permiso{" "}
          <code>rrhh.expedientes.compensacion.ver</code>. Pedile el PIN a un
          administrador — se genera una sola vez y no se puede recuperar después.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-[var(--nexo-accent)]/50 bg-black/20 px-6 py-4">
          <p className="text-xs uppercase tracking-wide text-white/40">
            PIN de kiosko — se muestra una sola vez
          </p>
          <p className="text-4xl font-bold tabular-nums tracking-[0.3em] text-white">
            {result.pinKiosko}
          </p>
          <p className="mt-1 text-xs text-white/40">
            Anotalo o entregáselo ahora al empleado — no se puede volver a ver.
          </p>
        </div>
      )}

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
