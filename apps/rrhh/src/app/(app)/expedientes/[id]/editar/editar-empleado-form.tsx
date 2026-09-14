"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@nexo/ui";
import { editarEmpleado, type EmpleadoInput } from "../actions";

export interface EmpleadoEditable {
  id: string;
  nombre: string;
  apellido: string;
  documento_identidad: string | null;
  email: string | null;
  telefono: string | null;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

/**
 * [Cancelar] [Guardar cambios] — Cancelar no muta nada y vuelve a la
 * ficha; Guardar pasa por idle → Guardando… → éxito/error (P3, regla
 * obligatoria del bloque). Un error deja el formulario abierto con los
 * datos tal cual estaban, nunca tumba la página.
 */
export default function EditarEmpleadoForm({ empleado }: { empleado: EmpleadoEditable }) {
  const router = useRouter();
  const { show } = useToast();
  const [form, setForm] = useState<EmpleadoInput>({
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    documentoIdentidad: empleado.documento_identidad ?? "",
    email: empleado.email ?? "",
    telefono: empleado.telefono ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof EmpleadoInput>(key: K, value: EmpleadoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await editarEmpleado(empleado.id, form);
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar el expediente.");
        show(res.message ?? "No se pudo guardar el expediente.", "error");
        return;
      }
      show("Empleado actualizado correctamente.", "success");
      router.push(`/expedientes/${empleado.id}`);
    });
  }

  function cancelar() {
    router.push(`/expedientes/${empleado.id}`);
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombres">
          <input
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Apellidos">
          <input
            value={form.apellido}
            onChange={(e) => update("apellido", e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Documento de identidad">
          <input
            value={form.documentoIdentidad}
            onChange={(e) => update("documentoIdentidad", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Correo">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Teléfono">
          <input
            value={form.telefono}
            onChange={(e) => update("telefono", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={cancelar}
          disabled={isPending}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
