import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Ingresar · Panel de clientes",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-concreto px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-acero-medio">
            Materiales J Castillo
          </p>
          <h1 className="mt-2 font-display text-2xl text-acero">
            Panel de clientes
          </h1>
        </div>

        <div className="rounded-md border border-acero-medio/25 bg-white/60 p-6 shadow-sm">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center font-mono text-xs text-acero-medio">
          Acceso restringido al equipo de Materiales J Castillo.
        </p>
      </div>
    </div>
  );
}
