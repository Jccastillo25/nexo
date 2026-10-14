"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, FormSection, useToast } from "@nexo/ui";
import { cambiarEstadoUsuario, restablecerPassword } from "../actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

/** Restablecer contraseña temporal y activar/desactivar la cuenta. */
export default function CuentaAcciones({
  userId,
  activo,
  puedeCambiarEstado,
}: {
  userId: string;
  activo: boolean;
  puedeCambiarEstado: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [password, setPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [isPending, startTransition] = useTransition();

  function restablecer() {
    if (password.length < 8) {
      setErrorPassword("La contraseña temporal debe tener al menos 8 caracteres.");
      return;
    }
    startTransition(async () => {
      const res = await restablecerPassword(userId, password);
      if (!res.ok) {
        setErrorPassword(res.message ?? "No se pudo restablecer la contraseña.");
        return;
      }
      setPassword("");
      setErrorPassword(null);
      show("Contraseña restablecida. Deberá cambiarla al entrar.", "success");
      router.refresh();
    });
  }

  function cambiarEstado() {
    startTransition(async () => {
      const res = await cambiarEstadoUsuario(userId, !activo);
      setConfirmar(false);
      show(res.ok ? (activo ? "Usuario desactivado." : "Usuario reactivado.") : res.message ?? "No se pudo cambiar el estado.", res.ok ? "success" : "error");
      router.refresh();
    });
  }

  return (
    <>
      <FormSection title="Contraseña" description="Poné una contraseña temporal nueva; el usuario la cambia al entrar.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrorPassword(null);
            }}
            placeholder="Nueva contraseña temporal"
            aria-label="Nueva contraseña temporal"
            className={inputClass}
          />
          <button
            type="button"
            onClick={restablecer}
            disabled={isPending}
            className="shrink-0 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            Restablecer
          </button>
        </div>
        {errorPassword && <p className="text-xs text-red-600">{errorPassword}</p>}
      </FormSection>

      {puedeCambiarEstado && (
        <FormSection
          title={activo ? "Desactivar usuario" : "Reactivar usuario"}
          description={
            activo
              ? "Bloquea el inicio de sesión y quita todos sus permisos. Conserva su rol y su historial."
              : "Vuelve a permitir el inicio de sesión con su rol actual."
          }
        >
          <div>
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              disabled={isPending}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                activo ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {activo ? "Desactivar" : "Reactivar"}
            </button>
          </div>
        </FormSection>
      )}

      <ConfirmDialog
        open={confirmar}
        title={activo ? "¿Desactivar este usuario?" : "¿Reactivar este usuario?"}
        description={
          activo
            ? "No podrá iniciar sesión ni usar ninguna aplicación hasta que lo reactives."
            : "Podrá volver a iniciar sesión con su rol actual."
        }
        confirmLabel={activo ? "Desactivar" : "Reactivar"}
        destructive={activo}
        pending={isPending}
        onCancel={() => setConfirmar(false)}
        onConfirm={cambiarEstado}
      />
    </>
  );
}
