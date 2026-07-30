import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("drivers")
    .select("id, full_name, username, email, is_active")
    .order("full_name");

  const safeQ = q.trim().replace(/[,()%"]/g, "");
  if (safeQ) {
    query = query.or(`full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%,username.ilike.%${safeQ}%`);
  }
  if (status === "active") {
    query = query.eq("is_active", true);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  }

  const { data: drivers } = await query;
  const hasFilters = Boolean(safeQ) || status !== "all";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Conductores</h1>
        <Link
          href="/admin/drivers/new"
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
        >
          + Crear conductor
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-900 p-4">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, usuario o correo"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
        >
          Filtrar
        </button>
        {hasFilters && (
          <Link
            href="/admin/drivers"
            className="text-sm font-semibold text-slate-400 hover:text-slate-200"
          >
            Limpiar
          </Link>
        )}
      </form>

      <div className="flex flex-col gap-2">
        {(drivers ?? []).map((d) => (
          <Link
            key={d.id}
            href={`/admin/drivers/${d.id}`}
            className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 hover:bg-slate-800"
          >
            <div>
              <p className="font-semibold text-white">{d.full_name}</p>
              <p className="text-sm text-slate-400">
                @{d.username} · {d.email}
              </p>
            </div>
            <span
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                d.is_active ? "bg-slate-800 text-slate-300" : "bg-red-900 text-red-200"
              }`}
            >
              {d.is_active ? "Activo" : "Inactivo"}
            </span>
          </Link>
        ))}
        {(drivers ?? []).length === 0 && (
          <p className="text-slate-500">
            {hasFilters ? "Ningún conductor coincide con ese filtro." : "Sin conductores registrados todavía."}
          </p>
        )}
      </div>
    </div>
  );
}
