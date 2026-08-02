import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InspectionForm } from "./InspectionForm";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { vehicle: vehicleId } = await searchParams;
  if (!vehicleId) redirect("/driver");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("drivers")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, license_plate, current_odometer")
    .eq("id", vehicleId)
    .maybeSingle();

  if (!vehicle) redirect("/driver");

  const { data: anomalyCategories } = await supabase
    .from("anomaly_categories")
    .select("id, name, blocks_trip")
    .order("name");

  return (
    <main className="px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-slate-100">Inspección previa</h1>
      <p className="mb-6 text-slate-400">{vehicle.license_plate}</p>
      <InspectionForm
        companyId={profile!.company_id}
        driverId={user!.id}
        vehicleId={vehicle.id}
        anomalyCategories={anomalyCategories ?? []}
      />
    </main>
  );
}
