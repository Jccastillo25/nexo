import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/duration";
import { TRIP_STATUS_LABEL } from "@/lib/trip-status";
import { TripFinancialCell } from "./TripFinancialCell";
import type { Database } from "@/lib/supabase/database.types";

type TripEventType = Database["public"]["Enums"]["trip_event_type"];

function eventTime(events: { event_type: TripEventType; recorded_at: string | null }[], type: TripEventType) {
  return events.find((e) => e.event_type === type)?.recorded_at ?? null;
}

export default async function AdminFleetTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ financial?: string }>;
}) {
  const { financial } = await searchParams;
  const financialPending = financial === "pending";
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, license_plate, brand, model, status, current_odometer")
    .order("license_plate");

  let tripsQuery = supabase
    .from("trips")
    .select(
      "id, status, start_odometer, end_odometer, created_at, invoice_number, trip_value, settlement_id, vehicle:vehicles(license_plate), driver:drivers(full_name), trip_events(event_type, recorded_at), settlement:settlements(status)",
    )
    .order("created_at", { ascending: false });

  tripsQuery = financialPending
    ? tripsQuery.eq("status", "completed").or("trip_value.is.null,invoice_number.is.null").limit(100)
    : tripsQuery.limit(30);

  const { data: trips } = await tripsQuery;

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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-100">Viajes recientes</h2>
          <Link
            href={financialPending ? "/admin/fleet-trips" : "/admin/fleet-trips?financial=pending"}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              financialPending ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300"
            }`}
          >
            {financialPending ? "✕ Quitar filtro" : "Pendiente de Datos Financieros"}
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-2">Vehículo</th>
                <th className="px-3 py-2">Conductor</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Tiempo en ruta</th>
                <th className="px-3 py-2">Tiempo de descarga</th>
                <th className="px-3 py-2">Facturación</th>
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
                    <td className="px-3 py-2">
                      <TripFinancialCell
                        tripId={t.id}
                        invoiceNumber={t.invoice_number}
                        tripValue={t.trip_value}
                        locked={t.settlement?.status === "completed"}
                      />
                    </td>
                  </tr>
                );
              })}
              {(trips ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    {financialPending
                      ? "No hay viajes con datos financieros pendientes."
                      : "Sin viajes registrados todavía."}
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
