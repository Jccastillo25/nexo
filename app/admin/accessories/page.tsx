import { createClient } from "@/lib/supabase/server";
import { NewAccessoryForm } from "./NewAccessoryForm";

export default async function AdminAccessoriesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  const { data: accessories } = await supabase
    .from("accessories")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="mb-3 text-xl font-bold text-slate-100">Catálogo de accesorios</h1>
        <div className="flex flex-col gap-2">
          {(accessories ?? []).map((a) => (
            <div key={a.id} className="rounded-xl bg-slate-900 px-4 py-3 text-slate-200">
              {a.name}
            </div>
          ))}
          {(accessories ?? []).length === 0 && (
            <p className="text-slate-500">Sin accesorios registrados todavía.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">Agregar accesorio</h2>
        <NewAccessoryForm companyId={profile!.company_id} />
      </section>
    </div>
  );
}
