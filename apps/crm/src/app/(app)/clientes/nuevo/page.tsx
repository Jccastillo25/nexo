import Link from "next/link";
import type { Metadata } from "next";
import ClienteForm from "@/components/ClienteForm";

export const metadata: Metadata = {
  title: "Nuevo cliente · Panel de clientes",
};

export default function NuevoClientePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/clientes"
          className="font-mono text-xs uppercase tracking-wide text-acero-medio hover:text-naranja"
        >
          ← Volver al listado
        </Link>
        <h1 className="mt-2 font-display text-2xl text-acero">
          Nuevo cliente
        </h1>
      </div>

      <div className="rounded-md border border-acero-medio/20 bg-white/50 p-5 sm:p-6">
        <ClienteForm mode="create" />
      </div>
    </div>
  );
}
