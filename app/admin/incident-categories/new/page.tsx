import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewIncidentCategoryForm } from "./NewIncidentCategoryForm";

export default async function NewIncidentCategoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("admins")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/incident-categories" className="text-sm text-slate-400 hover:text-slate-200">
          ← Volver a categorías de novedad
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-100">Crear categoría de novedad</h1>
      </div>
      <NewIncidentCategoryForm companyId={profile!.company_id} />
    </div>
  );
}
