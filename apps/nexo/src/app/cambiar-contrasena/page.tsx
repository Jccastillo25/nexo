import type { Metadata } from "next";
import { signOut } from "@/app/login/actions";
import CambioForm from "./cambio-form";

export const metadata: Metadata = {
  title: "Cambiar contraseña · Nexo",
};

/**
 * Primer ingreso con contraseña temporal (decisión 2026-10-14: el
 * administrador pone la contraseña). Fuera del grupo (app) a propósito: sin
 * sidebar ni apps hasta que la persona ponga su propia contraseña. El
 * middleware ya exige sesión.
 */
export default function CambiarContrasenaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">Elegí tu contraseña</h1>
        <p className="mt-1 mb-6 text-sm text-neutral-500">
          Entraste con una contraseña temporal. Poné una nueva para continuar.
        </p>
        <CambioForm />
        <form action={signOut} className="mt-4 text-center">
          <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-900">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
