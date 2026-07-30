import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SupadminCompaniesPage() {
  const admin = createAdminClient();

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, is_active, max_users, max_drivers, admins(count), drivers(count)")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Empresas</h1>
        <Link
          href="/supadmin/companies/new"
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Nueva empresa
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-3 py-2">Empresa</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Administradores</th>
              <th className="px-3 py-2">Conductores</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(companies ?? []).map((c) => {
              const adminCount = Array.isArray(c.admins) ? (c.admins[0]?.count ?? 0) : 0;
              const driverCount = Array.isArray(c.drivers) ? (c.drivers[0]?.count ?? 0) : 0;
              return (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-semibold">{c.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        c.is_active ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"
                      }`}
                    >
                      {c.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {adminCount} / {c.max_users ?? "∞"}
                  </td>
                  <td className="px-3 py-2">
                    {driverCount} / {c.max_drivers ?? "∞"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/supadmin/companies/${c.id}`}
                      className="font-semibold text-amber-400 hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(companies ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Sin empresas registradas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
