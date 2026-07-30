import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditDriverForm } from "./EditDriverForm";
import { PinPanel } from "./PinPanel";

export default async function EditDriverPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const { driverId } = await params;
  const supabase = await createClient();

  const { data: driver } = await supabase
    .from("drivers")
    .select(
      "id, first_name, last_name, username, national_id, license_number, license_type, license_expiry, is_active, pin_code",
    )
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) redirect("/admin/drivers");

  const [{ data: categories }, { data: assigned }] = await Promise.all([
    supabase.from("license_categories").select("id, name").order("name"),
    supabase.from("driver_license_categories").select("category_id").eq("driver_id", driverId),
  ]);

  const assignedIds = (assigned ?? []).map((a) => a.category_id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/drivers" className="text-sm text-slate-400 hover:text-slate-200">
          ← Volver a conductores
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-100">
          {driver.first_name} {driver.last_name}
        </h1>
      </div>

      <EditDriverForm driver={driver} categories={categories ?? []} initiallyAssignedIds={assignedIds} />

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">PIN de acceso</h2>
        <PinPanel driverId={driver.id} pin={driver.pin_code} />
      </section>
    </div>
  );
}
