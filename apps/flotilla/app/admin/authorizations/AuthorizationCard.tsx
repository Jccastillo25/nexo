"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BigButton } from "@/components/BigButton";

type Trip = {
  id: string;
  start_odometer: number;
  vehicle: { id: string; license_plate: string } | null;
  driver: { full_name: string } | null;
};

type Anomaly = {
  description: string | null;
  category: { name: string } | null;
} | null;

export function AuthorizationCard({
  trip,
  anomaly,
  photoUrl,
}: {
  trip: Trip;
  anomaly: Anomaly;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"authorize" | "deny" | null>(null);

  async function handleAuthorize() {
    setError(null);
    setLoading("authorize");

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("trips")
      .update({ status: "inspected" })
      .eq("id", trip.id);

    setLoading(null);
    if (updateError) {
      setError("No se pudo autorizar el viaje.");
      return;
    }
    router.refresh();
  }

  async function handleDeny() {
    setError(null);
    setLoading("deny");

    const supabase = createClient();
    const { error: tripError } = await supabase
      .from("trips")
      .update({ status: "cancelled" })
      .eq("id", trip.id);

    if (tripError) {
      setLoading(null);
      setError("No se pudo denegar el viaje.");
      return;
    }

    if (trip.vehicle) {
      await supabase.from("vehicles").update({ status: "maintenance" }).eq("id", trip.vehicle.id);
    }

    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-red-500/40 bg-slate-900 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-1 gap-4">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- foto de evidencia en Storage privado (URL firmada)
          <img
            src={photoUrl}
            alt="Evidencia de la novedad"
            className="h-24 w-24 shrink-0 rounded-lg object-cover"
          />
        )}
        <div>
          <p className="font-semibold text-white">
            {trip.vehicle?.license_plate} · {trip.driver?.full_name}
          </p>
          <p className="text-sm font-semibold text-red-300">{anomaly?.category?.name ?? "Novedad"}</p>
          {anomaly?.description && <p className="mt-1 text-sm text-slate-400">{anomaly.description}</p>}
          <p className="mt-1 text-xs text-slate-500">
            Odómetro inicial: {trip.start_odometer.toLocaleString()} km
          </p>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:w-56">
        <BigButton
          variant="success"
          loading={loading === "authorize"}
          onClick={handleAuthorize}
          className="px-4 py-3 text-sm"
        >
          Autorizar Excepción
        </BigButton>
        <BigButton
          variant="danger"
          loading={loading === "deny"}
          onClick={handleDeny}
          className="px-4 py-3 text-sm"
        >
          Denegar y Enviar a Mantenimiento
        </BigButton>
      </div>
    </div>
  );
}
