import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettlementsPage() {
  const supabase = await createClient();

  const { data: settlements } = await supabase
    .from("settlements")
    .select("id, start_date, end_date, status, final_payout, driver:drivers(full_name)")
    .order("driver_id", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-100">Liquidaciones</h1>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Conductor</th>
              <th className="px-3 py-2">Período</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Total a pagar</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(settlements ?? []).map((s) => (
              <tr key={s.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-semibold">{s.driver?.full_name}</td>
                <td className="px-3 py-2 text-slate-400">
                  {new Date(s.start_date).toLocaleDateString()} – {new Date(s.end_date).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      s.status === "completed"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {s.status === "completed" ? "Sellada" : "Pendiente de liquidar"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {s.final_payout !== null ? `$${s.final_payout.toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/settlements/${s.id}`}
                    className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900"
                  >
                    {s.status === "completed" ? "Ver" : "Liquidar"}
                  </Link>
                </td>
              </tr>
            ))}
            {(settlements ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Sin liquidaciones todavía — se crean cuando un conductor cierra su ciclo
                  (&ldquo;Llenado Final de Tanque&rdquo;) desde su dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
