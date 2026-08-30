"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createCliente, updateCliente, type ClienteFormState } from "@/app/(app)/clientes/actions";
import type { Cliente } from "@/lib/supabase/database.types";
import DatosExtraEditor from "./DatosExtraEditor";
import DeleteClienteButton from "./DeleteClienteButton";

const initialState: ClienteFormState = { error: null };

const inputClass =
  "w-full rounded-sm border border-acero-medio/40 bg-white px-3 py-2 font-mono text-sm text-acero outline-none focus:border-naranja focus:ring-1 focus:ring-naranja";
const labelClass =
  "text-xs font-mono uppercase tracking-wide text-acero-medio";

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
          <div className="w-fit rounded-sm border border-acero-medio/25 bg-acero-medio/10 px-3 py-2 font-mono text-sm text-acero-medio">
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
          className="rounded-sm border border-red-700/30 bg-red-700/10 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-acero-medio/20 pt-4">
        {mode === "edit" && cliente ? (
          <DeleteClienteButton id={cliente.id} nombre={cliente.nombre} />
        ) : (
          <span />
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-sm bg-naranja px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-naranja/90 disabled:cursor-not-allowed disabled:opacity-60"
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
