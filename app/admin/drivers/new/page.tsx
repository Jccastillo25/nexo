import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewDriverForm } from "./NewDriverForm";

export default async function NewDriverPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("license_categories")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/drivers" className="text-sm text-slate-400 hover:text-slate-200">
          ← Volver a conductores
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-100">Crear conductor</h1>
      </div>
      <NewDriverForm categories={categories ?? []} />
    </div>
  );
}
