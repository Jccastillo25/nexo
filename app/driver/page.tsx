import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DriverDashboard } from "./DriverDashboard";

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

  const { data: profile } = await supabase
    .from("drivers")
    .select("company_id, current_vehicle_id")
    .eq("id", user!.id)
    .single();

  const [{ data: vehicles }, { data: assignedVehicle }, { data: cycleTrips }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, license_plate, brand, model, current_odometer")
      .eq("status", "active")
      .order("license_plate"),
    profile!.current_vehicle_id
      ? supabase
          .from("vehicles")
          .select("id, license_plate, brand, model, status")
          .eq("id", profile!.current_vehicle_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("trips")
      .select("trip_value")
      .eq("driver_id", user!.id)
      .eq("status", "completed")
      .is("settlement_id", null),
  ]);

  const cycleSummary = {
    count: cycleTrips?.length ?? 0,
    totalValue: (cycleTrips ?? []).reduce((sum, t) => sum + (t.trip_value ?? 0), 0),
  };

  return (
    <main className="px-4 py-6">
      <DriverDashboard
        driverId={user!.id}
        companyId={profile!.company_id}
        assignedVehicle={assignedVehicle ?? null}
        vehicles={vehicles ?? []}
        cycleSummary={cycleSummary}
      />
    </main>
  );
}
