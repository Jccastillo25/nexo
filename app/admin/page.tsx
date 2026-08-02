import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/StatCard";
import { TRIP_STATUS_LABEL } from "@/lib/trip-status";
import { DailyTripsChart, StatusBreakdownChart } from "./AdminCharts";
import type { Database } from "@/lib/supabase/database.types";

type TripStatus = Database["public"]["Enums"]["trip_status"];

const DAY_LABEL = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric" });

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [
    { count: activeVehicles },
    { count: activeDrivers },
    { count: tripsInProgress },
    { count: pendingAuthorizations },
    { data: recentTrips },
  ] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(completed,cancelled)"),
    supabase
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_authorization"),
    supabase
      .from("trips")
      .select("status, created_at")
      .gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const trips = recentTrips ?? [];
  const completedLast30d = trips.filter((t) => t.status === "completed").length;

  const dailyBuckets = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(sevenDaysAgo.getDate() + i);
    dailyBuckets.set(dayKey(d.toISOString()), 0);
  }
  for (const trip of trips) {
    const key = dayKey(trip.created_at ?? "");
    if (dailyBuckets.has(key)) {
      dailyBuckets.set(key, (dailyBuckets.get(key) ?? 0) + 1);
    }
  }
  const dailyData = [...dailyBuckets.entries()].map(([key, count]) => ({
    day: DAY_LABEL.format(new Date(`${key}T00:00:00`)),
    count,
  }));

  const statusCounts = new Map<TripStatus, number>();
  for (const trip of trips) {
    statusCounts.set(trip.status, (statusCounts.get(trip.status) ?? 0) + 1);
  }
  const statusData = [...statusCounts.entries()].map(([status, count]) => ({
    label: TRIP_STATUS_LABEL[status],
    count,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400">Resumen operativo de los últimos 30 días.</p>
      </div>

      {(pendingAuthorizations ?? 0) > 0 && (
        <Link
          href="/admin/authorizations"
          className="flex items-center justify-between rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-red-200 hover:bg-red-950/60"
        >
          <span className="font-semibold">
            {pendingAuthorizations} viaje{pendingAuthorizations === 1 ? "" : "s"} esperando autorización
          </span>
          <span className="text-sm font-semibold text-red-300">Revisar →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Vehículos activos" value={activeVehicles ?? 0} />
        <StatCard label="Conductores activos" value={activeDrivers ?? 0} />
        <StatCard label="Viajes en curso" value={tripsInProgress ?? 0} />
        <StatCard label="Completados (30d)" value={completedLast30d} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-lg font-bold text-slate-100">Viajes por día (últimos 7 días)</h2>
          <DailyTripsChart data={dailyData} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-lg font-bold text-slate-100">Viajes por estado (30 días)</h2>
          <StatusBreakdownChart data={statusData} />
        </div>
      </div>

      <Link href="/admin/fleet-trips" className="text-sm font-semibold text-amber-400 hover:underline">
        Ver flota y viajes completos →
      </Link>
    </div>
  );
}
