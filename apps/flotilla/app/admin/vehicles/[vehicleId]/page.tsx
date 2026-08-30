import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VehicleStatusForm } from "./VehicleStatusForm";
import { AccessoryAssignment } from "./AccessoryAssignment";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const supabase = await createClient();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, license_plate, status")
    .eq("id", vehicleId)
    .maybeSingle();

  if (!vehicle) redirect("/admin/vehicles");

  const { data: accessories } = await supabase
    .from("accessories")
    .select("id, name")
    .order("name");

  const { data: assigned } = await supabase
    .from("vehicle_accessories")
    .select("accessory_id")
    .eq("vehicle_id", vehicleId);

  const assignedIds = new Set((assigned ?? []).map((a) => a.accessory_id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-1 text-xl font-bold text-slate-100">{vehicle.license_plate}</h1>
        <p className="text-slate-400">Edición de vehículo</p>
      </div>

      <VehicleStatusForm vehicleId={vehicle.id} status={vehicle.status ?? "active"} />

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">
          Checklist de accesorios de esta unidad
        </h2>
        <AccessoryAssignment
          vehicleId={vehicle.id}
          accessories={accessories ?? []}
          initiallyAssignedIds={[...assignedIds]}
        />
      </section>
    </div>
  );
}
