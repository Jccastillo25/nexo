"use client";

// Boton de envio para formularios con Server Action (<form action={accion}>):
// lee useFormStatus() y muestra el spinner + deshabilita mientras la accion
// corre, sin estado propio en la pantalla. Solo funciona DENTRO de un <form>
// cuyo `action` es una funcion; con onSubmit + useTransition usa <Button
// type="submit" loading={isPending}> en su lugar.
//
//   <form action={guardarProducto}>
//     ...
//     <SubmitButton pendingLabel="Guardando…">Guardar producto</SubmitButton>
//   </form>
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

export interface SubmitButtonProps extends Omit<ButtonProps, "type"> {
  /** Texto mientras la accion esta en curso (por defecto, el mismo texto). */
  pendingLabel?: ReactNode;
}

export function SubmitButton({ loading = false, pendingLabel, children, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const busy = pending || loading;
  return (
    <Button {...rest} type="submit" loading={busy}>
      {busy && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
