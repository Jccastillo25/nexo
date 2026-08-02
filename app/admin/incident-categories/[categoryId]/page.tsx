import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditIncidentCategoryForm } from "./EditIncidentCategoryForm";

export default async function EditIncidentCategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("anomaly_categories")
    .select("id, name, blocks_trip")
    .eq("id", categoryId)
    .maybeSingle();

  if (!category) redirect("/admin/incident-categories");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/incident-categories" className="text-sm text-slate-400 hover:text-slate-200">
          ← Volver a categorías de novedad
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-100">{category.name}</h1>
      </div>
      <EditIncidentCategoryForm category={category} />
    </div>
  );
}
