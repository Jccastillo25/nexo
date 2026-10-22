"use client";

import { useState, useTransition } from "react";
import { Alert, Button, ButtonLink, Field, Input, NexoIcon, useToast } from "@nexo/ui";
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
 * crea despues, sobre este mismo empleado. "Crear empleado != contratar
 * empleado" (docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md).
 *
 * Feedback idle→loading→success/error via useToast, ademas del panel de
 * exito.
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
        documentoIdentidad: form.documentoIdentidad,
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
    return (
      <ExpedienteCreadoPanel
        result={result}
        onNuevo={() => {
          setResult(null);
          setForm(EMPTY_FORM);
        }}
      />
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-xs"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombres" required>
          <Input
            required
            value={form.nombre}
            onChange={(e) => update("nombre", e.target.value)}
            autoComplete="off"
            placeholder="Julio César"
          />
        </Field>
        <Field label="Apellidos" required>
          <Input
            required
            value={form.apellido}
            onChange={(e) => update("apellido", e.target.value)}
            autoComplete="off"
            placeholder="Castillo Canales"
          />
        </Field>
        <Field label="Documento de identidad (cédula)" required>
          <Input
            required
            value={form.documentoIdentidad}
            onChange={(e) => update("documentoIdentidad", e.target.value)}
            autoComplete="off"
            placeholder="001-010190-0001A"
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

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/expedientes" variant="ghost">
          Cancelar
        </ButtonLink>
        <Button type="submit" loading={isPending}>
          {isPending ? "Creando…" : "Crear empleado"}
        </Button>
      </div>
    </form>
  );
}

function ExpedienteCreadoPanel({
  result,
  onNuevo,
}: {
  result: CrearEmpleadoResult;
  onNuevo: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-xs"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 [&_svg]:size-6"
      >
        <NexoIcon name="check-circle" />
      </span>
      <div>
        <p className="text-lg font-semibold text-neutral-900">Expediente creado</p>
        <p className="text-sm text-neutral-500">
          Código <span className="font-mono text-neutral-700">#{result.codigoEmpleado}</span>
        </p>
      </div>

      <p className="max-w-sm rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        Todavía no tiene contrato ni PIN de asistencia. Para habilitarlo a trabajar, crea un contrato y actívalo:
        el PIN se genera automáticamente en ese momento.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onClick={onNuevo}>
          Crear otro empleado
        </Button>
        {result.empleadoId ? (
          <ButtonLink href={`/expedientes/${result.empleadoId}`}>Ver expediente</ButtonLink>
        ) : (
          <ButtonLink href="/expedientes">Volver al listado</ButtonLink>
        )}
      </div>
    </div>
  );
}
