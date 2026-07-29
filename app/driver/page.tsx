import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VehiclePicker } from "./VehiclePicker";

export default async function DriverHomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: activeTrip } = await supabase
    .from("trips")
    .select("id")
    .eq("driver_id", user!.id)
    .not("status", "in", "(completed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeTrip) {
    redirect(`/driver/trips/${activeTrip.id}`);
  }

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, license_plate, brand, model, current_odometer")
    .eq("status", "active")
    .order("license_plate");

  return (
    <main className="px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-slate-100">Selecciona tu unidad</h1>
      <VehiclePicker vehicles={vehicles ?? []} />
    </main>
  );
}
