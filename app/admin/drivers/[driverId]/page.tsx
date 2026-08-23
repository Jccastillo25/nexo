import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditDriverForm } from "./EditDriverForm";
import { PinPanel } from "./PinPanel";
import { DriverAdvances } from "./DriverAdvances";

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
      "id, company_id, first_name, last_name, username, national_id, license_number, license_type, license_expiry, is_active, pin_code, commission_percentage, current_vehicle_id",
    )
    .eq("id", driverId)
    .maybeSingle();

  if (!driver) redirect("/admin/drivers");

  const [{ data: categories }, { data: assigned }, { data: vehicles }, { data: advances }] = await Promise.all([
    supabase.from("license_categories").select("id, name").order("name"),
    supabase.from("driver_license_categories").select("category_id").eq("driver_id", driverId),
    supabase.from("vehicles").select("id, license_plate").order("license_plate"),
    supabase
      .from("driver_advances")
      .select("id, amount, description, settlement_id, created_at")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false }),
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

      <EditDriverForm
        driver={driver}
        categories={categories ?? []}
        vehicles={vehicles ?? []}
        initiallyAssignedIds={assignedIds}
      />

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">PIN de acceso</h2>
        <PinPanel driverId={driver.id} pin={driver.pin_code} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">Anticipos</h2>
        <DriverAdvances driverId={driver.id} companyId={driver.company_id} advances={advances ?? []} />
      </section>
    </div>
  );
}
