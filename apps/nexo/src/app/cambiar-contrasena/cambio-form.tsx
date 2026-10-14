"use client";

import { useActionState } from "react";
import { cambiarPassword, type CambioState } from "./actions";

const initialState: CambioState = { error: null };

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

export default function CambioForm() {
  const [state, formAction, isPending] = useActionState(cambiarPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-neutral-500">
          Nueva contraseña
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmacion" className="text-xs font-medium text-neutral-500">
          Repetí la contraseña
        </label>
        <input id="confirmacion" name="confirmacion" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </div>

      {state.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
