import { createClient } from "@/lib/supabase/server";
import { NewCategoryForm } from "./NewCategoryForm";

export default async function AdminLicenseCategoriesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("admins")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  const { data: categories } = await supabase
    .from("license_categories")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="mb-3 text-xl font-bold text-slate-100">Categorías de licencia</h1>
        <p className="mb-3 text-slate-400">
          Estas categorías aparecen para seleccionar al crear o editar un conductor.
        </p>
        <div className="flex flex-col gap-2">
          {(categories ?? []).map((c) => (
            <div key={c.id} className="rounded-xl bg-slate-900 px-4 py-3 text-slate-200">
              {c.name}
            </div>
          ))}
          {(categories ?? []).length === 0 && (
            <p className="text-slate-500">Sin categorías registradas todavía.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">Agregar categoría</h2>
        <NewCategoryForm companyId={profile!.company_id} />
      </section>
    </div>
  );
}
