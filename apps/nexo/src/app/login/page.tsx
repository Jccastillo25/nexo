import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Ingresar · Nexo",
};

// Estilo alineado a la referencia visual del usuario (login oscuro, tarjeta
// centrada) — sin la foto de fondo: Nexo es una herramienta interna, no un
// SaaS que necesite venderse a sí mismo en su propia pantalla de login.
export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-neutral-950 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
            Grupo CT
          </p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-50">Nexo</h1>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl sm:p-8">
          <h2 className="mb-6 text-lg font-semibold text-neutral-50">
            Iniciar sesión
          </h2>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
