"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, Field, FormSection, Input, useToast } from "@nexo/ui";
import { cambiarEstadoUsuario, restablecerPassword } from "../actions";

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
  // Una transición por acción: cada botón muestra su propio estado de carga.
  const [restableciendo, startRestablecer] = useTransition();
  const [cambiandoEstado, startCambioEstado] = useTransition();
  const ocupado = restableciendo || cambiandoEstado;

  function restablecer() {
    if (password.length < 8) {
      setErrorPassword("La contraseña temporal debe tener al menos 8 caracteres.");
      return;
    }
    startRestablecer(async () => {
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
    startCambioEstado(async () => {
      const res = await cambiarEstadoUsuario(userId, !activo);
      setConfirmar(false);
      show(res.ok ? (activo ? "Usuario desactivado." : "Usuario reactivado.") : res.message ?? "No se pudo cambiar el estado.", res.ok ? "success" : "error");
      router.refresh();
    });
  }

  return (
    <>
      <FormSection title="Contraseña" description="Pon una contraseña temporal nueva; el usuario la cambia al entrar.">
        <Field label="Nueva contraseña temporal" hint="Mínimo 8 caracteres." error={errorPassword}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorPassword(null);
              }}
            />
            <Button variant="secondary" onClick={restablecer} loading={restableciendo} disabled={cambiandoEstado}>
              Restablecer
            </Button>
          </div>
        </Field>
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
            <Button
              variant={activo ? "destructive" : "primary"}
              onClick={() => setConfirmar(true)}
              disabled={ocupado}
            >
              {activo ? "Desactivar" : "Reactivar"}
            </Button>
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
        pending={cambiandoEstado}
        onCancel={() => setConfirmar(false)}
        onConfirm={cambiarEstado}
      />
    </>
  );
}
