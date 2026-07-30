import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/duration";
import { TRIP_STATUS_LABEL } from "@/lib/trip-status";
import type { Database } from "@/lib/supabase/database.types";

type TripEventType = Database["public"]["Enums"]["trip_event_type"];

function eventTime(events: { event_type: TripEventType; recorded_at: string | null }[], type: TripEventType) {
  return events.find((e) => e.event_type === type)?.recorded_at ?? null;
}

export default async function AdminFleetTripsPage() {
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, license_plate, brand, model, status, current_odometer")
    .order("license_plate");

  const { data: trips } = await supabase
    .from("trips")
    .select(
      "id, status, start_odometer, end_odometer, created_at, vehicle:vehicles(license_plate), driver:drivers(full_name), trip_events(event_type, recorded_at)",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="mb-3 text-xl font-bold text-slate-100">Flota</h1>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-2">Placa</th>
                <th className="px-3 py-2">Marca/Modelo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Odómetro</th>
              </tr>
            </thead>
            <tbody>
              {(vehicles ?? []).map((v) => (
                <tr key={v.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-semibold">{v.license_plate}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-3 py-2">{v.status}</td>
                  <td className="px-3 py-2">{v.current_odometer.toLocaleString()} km</td>
                </tr>
              ))}
              {(vehicles ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    Sin vehículos registrados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-slate-100">Viajes recientes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-2">Vehículo</th>
                <th className="px-3 py-2">Conductor</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Tiempo en ruta</th>
                <th className="px-3 py-2">Tiempo de descarga</th>
              </tr>
            </thead>
            <tbody>
              {(trips ?? []).map((t) => {
                const events = t.trip_events ?? [];
                const enRuta = formatDuration(
                  eventTime(events, "start_trip"),
                  eventTime(events, "arrival_destination"),
                );
                const descarga = formatDuration(
                  eventTime(events, "start_unloading"),
                  eventTime(events, "end_unloading"),
                );
                return (
                  <tr key={t.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-semibold">{t.vehicle?.license_plate}</td>
                    <td className="px-3 py-2 text-slate-400">{t.driver?.full_name}</td>
                    <td className="px-3 py-2">{TRIP_STATUS_LABEL[t.status]}</td>
                    <td className="px-3 py-2">{enRuta}</td>
                    <td className="px-3 py-2">{descarga}</td>
                  </tr>
                );
              })}
              {(trips ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Sin viajes registrados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
