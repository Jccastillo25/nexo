import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ClienteForm from "@/components/ClienteForm";

export const metadata: Metadata = {
  title: "Editar cliente · Panel de clientes",
};

export default async function ClienteDetallePage({
  params,
}: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente, error } = await supabase
    .schema("crm")
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar el cliente: ${error.message}`);
  }
  if (!cliente) {
    notFound();
  }

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
          {cliente.nombre}
        </h1>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <ClienteForm mode="edit" cliente={cliente} />
      </div>
    </div>
  );
}
