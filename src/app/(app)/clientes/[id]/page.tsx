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
          className="font-mono text-xs uppercase tracking-wide text-acero-medio hover:text-naranja"
        >
          ← Volver al listado
        </Link>
        <h1 className="mt-2 font-display text-2xl text-acero">
          {cliente.nombre}
        </h1>
      </div>

      <div className="rounded-md border border-acero-medio/20 bg-white/50 p-5 sm:p-6">
        <ClienteForm mode="edit" cliente={cliente} />
      </div>
    </div>
  );
}
