import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TripCycle } from "./TripCycle";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, company_id, status, start_odometer, end_odometer, vehicle:vehicles(license_plate)")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) redirect("/driver");

  return (
    <main className="px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-slate-100">{trip.vehicle?.license_plate}</h1>
      <p className="mb-6 text-slate-400">Odómetro inicial: {trip.start_odometer.toLocaleString()} km</p>
      <TripCycle
        tripId={trip.id}
        companyId={trip.company_id}
        status={trip.status}
        startOdometer={trip.start_odometer}
      />
    </main>
  );
}
