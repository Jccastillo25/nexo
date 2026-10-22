"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input, useToast } from "@nexo/ui";
import { editarEmpleado, type EmpleadoInput } from "../actions";

export interface EmpleadoEditable {
  id: string;
  nombre: string;
  apellido: string;
  documento_identidad: string | null;
  email: string | null;
  telefono: string | null;
}

type ErroresCampo = Partial<Record<"nombre" | "apellido" | "documentoIdentidad", string>>;

/**
 * [Cancelar] [Guardar cambios] — Cancelar no muta nada y vuelve a la
 * ficha; Guardar pasa por idle → Guardando… → éxito/error (P3). Un error
 * deja el formulario abierto con los datos tal cual estaban, nunca tumba la
 * página. Los obligatorios vacíos se marcan junto a su campo.
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
  const [errores, setErrores] = useState<ErroresCampo>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof EmpleadoInput>(key: K, value: EmpleadoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errores) setErrores((e) => ({ ...e, [key]: undefined }));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const nuevos: ErroresCampo = {};
    if (!form.nombre.trim()) nuevos.nombre = "Escribe los nombres.";
    if (!form.apellido.trim()) nuevos.apellido = "Escribe los apellidos.";
    if (!form.documentoIdentidad.trim()) nuevos.documentoIdentidad = "La cédula es obligatoria.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

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
    <form
      onSubmit={guardar}
      noValidate
      className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-xs"
    >
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombres" required error={errores.nombre}>
          <Input value={form.nombre} onChange={(e) => update("nombre", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Apellidos" required error={errores.apellido}>
          <Input value={form.apellido} onChange={(e) => update("apellido", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Documento de identidad (cédula)" required error={errores.documentoIdentidad}>
          <Input
            value={form.documentoIdentidad}
            onChange={(e) => update("documentoIdentidad", e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Correo" optional>
          <Input
            type="email"
            inputMode="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Teléfono" optional>
          <Input
            type="tel"
            inputMode="tel"
            value={form.telefono}
            onChange={(e) => update("telefono", e.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={cancelar} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={isPending}>
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
