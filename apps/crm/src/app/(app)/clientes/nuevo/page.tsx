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
          className="text-xs uppercase tracking-wide text-neutral-500 hover:text-blue-600"
        >
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          Nuevo cliente
        </h1>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <ClienteForm mode="create" />
      </div>
    </div>
  );
}
