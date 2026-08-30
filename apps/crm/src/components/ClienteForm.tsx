"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createCliente, updateCliente, type ClienteFormState } from "@/app/(app)/clientes/actions";
import type { Cliente } from "@/lib/supabase/database.types";
import DatosExtraEditor from "./DatosExtraEditor";
import DeleteClienteButton from "./DeleteClienteButton";

const initialState: ClienteFormState = { error: null };

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "text-xs uppercase tracking-wide text-neutral-500";

export default function ClienteForm({
  mode,
  cliente,
}: {
  mode: "create" | "edit";
  cliente?: Cliente;
}) {
  const action =
    mode === "edit" && cliente
      ? updateCliente.bind(null, cliente.id)
      : createCliente;

  const [state, formAction, isPending] = useActionState(
    action,
    initialState
  );

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    } else if (state.success) {
      toast.success("Cliente actualizado.");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {mode === "edit" && cliente && (
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Número de cliente</span>
          <div className="w-fit rounded-md border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
            #{cliente.numero_cliente}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="nombre" className={labelClass}>
            Nombre *
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={cliente?.nombre ?? ""}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="telefono" className={labelClass}>
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            defaultValue={cliente?.telefono ?? ""}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ruc" className={labelClass}>
            RUC
          </label>
          <input
            id="ruc"
            name="ruc"
            defaultValue={cliente?.ruc ?? ""}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="direccion" className={labelClass}>
            Dirección
          </label>
          <input
            id="direccion"
            name="direccion"
            defaultValue={cliente?.direccion ?? ""}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="tipo_cliente" className={labelClass}>
            Tipo de cliente
          </label>
          <select
            id="tipo_cliente"
            name="tipo_cliente"
            defaultValue={cliente?.tipo_cliente ?? ""}
            className={inputClass}
          >
            <option value="">Sin especificar</option>
            <option value="mayorista">Mayorista</option>
            <option value="detal">Detal</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notas" className={labelClass}>
          Notas
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={4}
          defaultValue={cliente?.notas ?? ""}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Datos adicionales</span>
        <DatosExtraEditor initial={cliente?.datos_extra ?? null} />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        {mode === "edit" && cliente ? (
          <DeleteClienteButton id={cliente.id} nombre={cliente.nombre} />
        ) : (
          <span />
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "Guardando…"
            : mode === "create"
              ? "Crear cliente"
              : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
