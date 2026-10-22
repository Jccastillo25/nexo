import type { Metadata } from "next";
import { Button } from "@nexo/ui";
import { signOut } from "@nexo/auth";
import CambioForm from "./cambio-form";

export const metadata: Metadata = {
  title: "Cambiar contraseña · Nexo",
};

/**
 * Primer ingreso con contraseña temporal (decisión 2026-10-14: el
 * administrador pone la contraseña). Fuera del grupo (app) a propósito: sin
 * sidebar ni apps hasta que la persona ponga su propia contraseña. El
 * proxy ya exige sesión.
 */
export default function CambiarContrasenaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">Elige tu contraseña</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-500">
          Entraste con una contraseña temporal. Escribe una nueva para continuar.
        </p>
        <CambioForm />
        <form action={signOut} className="mt-4 flex justify-center">
          <Button variant="ghost" size="sm" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
