import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SearchBox from "@/components/SearchBox";
import ClientesTable from "@/components/ClientesTable";

export const metadata: Metadata = {
  title: "Clientes · Panel de clientes",
};

export default async function ClientesPage({
  searchParams,
}: PageProps<"/clientes">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();

  let request = supabase
    .from("clientes")
    .select("*")
    .order("numero_cliente", { ascending: false });

  if (query) {
    // Los comas rompen la sintaxis .or() de PostgREST; se descartan del término.
    const safe = query.replace(/[,()]/g, "");
    const numero = /^\d+$/.test(safe) ? safe : null;
    const filters = [`nombre.ilike.%${safe}%`, `ruc.ilike.%${safe}%`];
    if (numero) filters.push(`numero_cliente.eq.${numero}`);
    request = request.or(filters.join(","));
  }

  const { data: clientes, error } = await request;

  if (error) {
    throw new Error(`No se pudo cargar la lista de clientes: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="font-display text-2xl text-acero">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="inline-flex items-center justify-center rounded-sm bg-naranja px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-naranja/90"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <SearchBox initialValue={query} />
        <p className="font-mono text-xs text-acero-medio">
          {clientes?.length ?? 0} cliente{clientes?.length === 1 ? "" : "s"}
        </p>
      </div>

      <ClientesTable clientes={clientes ?? []} />
    </div>
  );
}
