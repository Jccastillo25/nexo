import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminIncidentCategoriesPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("anomaly_categories")
    .select("id, name, blocks_trip")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Categorías de novedad</h1>
          <p className="text-slate-400">
            Lo que el conductor puede reportar en la inspección diaria. Si una categoría bloquea el
            viaje, el conductor queda a la espera de autorización hasta que resuelvas la novedad.
          </p>
        </div>
        <Link
          href="/admin/incident-categories/new"
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
        >
          + Crear categoría
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {(categories ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/admin/incident-categories/${c.id}`}
            className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 hover:bg-slate-800"
          >
            <p className="font-semibold text-white">{c.name}</p>
            <span
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                c.blocks_trip ? "bg-red-900 text-red-200" : "bg-slate-800 text-slate-300"
              }`}
            >
              {c.blocks_trip ? "Bloquea el viaje" : "No bloquea"}
            </span>
          </Link>
        ))}
        {(categories ?? []).length === 0 && (
          <p className="text-slate-500">Sin categorías registradas todavía.</p>
        )}
      </div>
    </div>
  );
}
