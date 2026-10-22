"use client";

import { useActionState } from "react";
import { Alert, Field, Input, SubmitButton } from "@nexo/ui";
import { cambiarPassword, type CambioState } from "./actions";

const initialState: CambioState = { error: null };

export default function CambioForm() {
  const [state, formAction] = useActionState(cambiarPassword, initialState);
  const errorDe = (campo: NonNullable<CambioState["campo"]>) => (state.campo === campo ? state.error : null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Nueva contraseña" hint="Mínimo 8 caracteres." error={errorDe("password")}>
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Repite la contraseña" error={errorDe("confirmacion")}>
        <Input name="confirmacion" type="password" autoComplete="new-password" required minLength={8} />
      </Field>

      {state.error && !state.campo ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton fullWidth pendingLabel="Guardando…">
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
