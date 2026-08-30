import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAdminsPage() {
  const supabase = await createClient();

  const { data: admins } = await supabase
    .from("admins")
    .select("id, full_name, email, is_active")
    .order("full_name");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Administradores</h1>
        <Link
          href="/admin/admins/new"
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
        >
          + Crear administrador
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {(admins ?? []).map((a) => (
          <Link
            key={a.id}
            href={`/admin/admins/${a.id}`}
            className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 hover:bg-slate-800"
          >
            <div>
              <p className="font-semibold text-white">{a.full_name}</p>
              <p className="text-sm text-slate-400">{a.email}</p>
            </div>
            <span
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                a.is_active ? "bg-slate-800 text-slate-300" : "bg-red-900 text-red-200"
              }`}
            >
              {a.is_active ? "Activo" : "Inactivo"}
            </span>
          </Link>
        ))}
        {(admins ?? []).length === 0 && (
          <p className="text-slate-500">Sin administradores registrados todavía.</p>
        )}
      </div>
    </div>
  );
}
