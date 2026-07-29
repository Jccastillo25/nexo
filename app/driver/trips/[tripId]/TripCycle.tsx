"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadEvidencePhoto } from "@/lib/storage";
import { recordTripEvent, TripEventError } from "@/lib/trip-events";
import { PhotoCaptureInput } from "@/components/PhotoCaptureInput";
import { BigButton } from "@/components/BigButton";
import { TRIP_STATUS_LABEL } from "@/lib/trip-status";
import type { Database } from "@/lib/supabase/database.types";

type TripStatus = Database["public"]["Enums"]["trip_status"];

export function TripCycle({
  tripId,
  companyId,
  status,
  startOdometer,
}: {
  tripId: string;
  companyId: string;
  status: TripStatus;
  startOdometer: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endOdometer, setEndOdometer] = useState("");
  const [endOdometerPhoto, setEndOdometerPhoto] = useState<File | null>(null);

  async function runAction(
    eventType: Parameters<typeof recordTripEvent>[1],
    nextStatus: TripStatus,
    requireGps: boolean,
  ) {
    setError(null);
    setLoading(true);
    try {
      await recordTripEvent(tripId, eventType, { requireGps });

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("trips")
        .update({ status: nextStatus })
        .eq("id", tripId);
      if (updateError) throw updateError;

      router.refresh();
    } catch (err) {
      setError(err instanceof TripEventError ? err.message : "No se pudo registrar el evento.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFinishTrip(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const endValue = Number(endOdometer);
    if (!endOdometerPhoto) {
      setError("La foto del odómetro final es obligatoria.");
      return;
    }
    if (!Number.isFinite(endValue) || endValue < startOdometer) {
      setError(`El odómetro final debe ser mayor o igual a ${startOdometer.toLocaleString()} km.`);
      return;
    }

    setLoading(true);
    try {
      const photoPath = await uploadEvidencePhoto(
        endOdometerPhoto,
        `${companyId}/${tripId}/end-odometer.${endOdometerPhoto.type === "image/png" ? "png" : "jpg"}`,
      );

      await recordTripEvent(tripId, "finish_trip", { requireGps: false });

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("trips")
        .update({
          end_odometer: endValue,
          end_odometer_photo_url: photoPath,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", tripId);
      if (updateError) throw updateError;

      router.refresh();
    } catch (err) {
      setError(err instanceof TripEventError ? err.message : "No se pudo finalizar el viaje.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="inline-block w-fit rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-amber-400">
        {TRIP_STATUS_LABEL[status]}
      </p>

      {error && <p className="text-red-400">{error}</p>}

      {status === "inspected" && (
        <BigButton loading={loading} onClick={() => runAction("start_trip", "in_transit", true)}>
          Iniciar Viaje
        </BigButton>
      )}

      {status === "in_transit" && (
        <BigButton
          loading={loading}
          onClick={() => runAction("arrival_destination", "at_destination", true)}
        >
          Llegada a Destino
        </BigButton>
      )}

      {status === "at_destination" && (
        <BigButton loading={loading} onClick={() => runAction("start_unloading", "unloading", false)}>
          Iniciar Descarga
        </BigButton>
      )}

      {status === "unloading" && (
        <BigButton
          loading={loading}
          onClick={() => runAction("end_unloading", "unloading_completed", false)}
        >
          Finalizar Descarga
        </BigButton>
      )}

      {status === "unloading_completed" && (
        <form onSubmit={handleFinishTrip} className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-100">Retorno / Fin de Viaje</h2>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300">Odómetro final (km)</label>
            <input
              type="number"
              inputMode="numeric"
              required
              min={startOdometer}
              value={endOdometer}
              onChange={(e) => setEndOdometer(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-lg text-white"
            />
          </div>
          <PhotoCaptureInput label="Foto del tablero" required onCapture={setEndOdometerPhoto} />
          <BigButton type="submit" loading={loading}>
            Finalizar Viaje
          </BigButton>
        </form>
      )}

      {status === "completed" && (
        <p className="text-slate-300">Viaje completado. Puedes iniciar uno nuevo desde el inicio.</p>
      )}
    </div>
  );
}
