"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/clientes";
  const [state, formAction, isPending] = useActionState(
    signIn,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-xs font-mono uppercase tracking-wide text-acero-medio"
        >
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-sm border border-acero-medio/40 bg-white px-3 py-2.5 font-mono text-sm text-acero outline-none focus:border-naranja focus:ring-1 focus:ring-naranja"
          placeholder="correo@materialesjcastillo.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-xs font-mono uppercase tracking-wide text-acero-medio"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-sm border border-acero-medio/40 bg-white px-3 py-2.5 font-mono text-sm text-acero outline-none focus:border-naranja focus:ring-1 focus:ring-naranja"
          placeholder="••••••••"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-sm border border-red-700/30 bg-red-700/10 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-sm bg-naranja px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-naranja/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
