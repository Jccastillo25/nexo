import { createClient } from "@/lib/supabase/server";
import { NewUserForm } from "./NewUserForm";
import { ActiveToggle } from "./ActiveToggle";

export default async function AdminDriversPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email, role, is_active")
    .order("full_name");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="mb-3 text-xl font-bold text-slate-100">Usuarios</h1>
        <div className="flex flex-col gap-2">
          {(users ?? []).map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-white">{u.full_name}</p>
                <p className="text-sm text-slate-400">
                  {u.email} · {u.role === "admin" ? "Administrador" : "Conductor"}
                </p>
              </div>
              <ActiveToggle userId={u.id} isActive={u.is_active ?? true} />
            </div>
          ))}
          {(users ?? []).length === 0 && (
            <p className="text-slate-500">Sin usuarios registrados todavía.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">Crear usuario</h2>
        <NewUserForm />
      </section>
    </div>
  );
}
