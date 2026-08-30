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
type TripEventType = Database["public"]["Enums"]["trip_event_type"];

// Ciclo reducido: "Llegada a Destino" e "Iniciar Descarga" se fusionan en
// un solo tap (dos trip_events, un único cambio de status) — el conductor
// vive esto como un solo hecho ("llegué y ya estoy descargando"), no como
// dos pasos separados. at_destination deja de escribirse como status
// propio; el enum de la DB conserva el valor sin uso nuevo.
const ACTIONS: Record<
  string,
  { label: string; nextStatus: TripStatus; events: { type: TripEventType; requireGps: boolean }[] }
> = {
  inspected: {
    label: "Iniciar Viaje",
    nextStatus: "in_transit",
    events: [{ type: "start_trip", requireGps: true }],
  },
  in_transit: {
    label: "Llegué / Iniciar Descarga",
    nextStatus: "unloading",
    events: [
      { type: "arrival_destination", requireGps: true },
      { type: "start_unloading", requireGps: false },
    ],
  },
  // Compatibilidad: cualquier viaje que haya quedado en at_destination
  // antes de este cambio (arrival_destination ya registrado, falta
  // start_unloading) todavía puede avanzar — sin esto se quedaría sin
  // botón de acción, "atascado".
  at_destination: {
    label: "Iniciar Descarga",
    nextStatus: "unloading",
    events: [{ type: "start_unloading", requireGps: false }],
  },
  unloading: {
    label: "Finalizar Descarga",
    nextStatus: "unloading_completed",
    events: [{ type: "end_unloading", requireGps: false }],
  },
};

export function TripCycle({
  tripId,
  companyId,
  status: initialStatus,
  startOdometer,
}: {
  tripId: string;
  companyId: string;
  status: TripStatus;
  startOdometer: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endOdometer, setEndOdometer] = useState("");
  const [endOdometerPhoto, setEndOdometerPhoto] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [tripValue, setTripValue] = useState("");

  async function runAction(currentStatus: string) {
    const action = ACTIONS[currentStatus];
    setError(null);
    setLoading(true);
    try {
      for (const event of action.events) {
        await recordTripEvent(tripId, event.type, { requireGps: event.requireGps });
      }
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("trips")
        .update({ status: action.nextStatus })
        .eq("id", tripId);
      if (updateError) throw updateError;
      // Actualización local, sin router.refresh(): evita la recarga
      // completa de servidor por cada tap, se siente instantáneo.
      setStatus(action.nextStatus);
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
          invoice_number: invoiceNumber.trim() || null,
          trip_value: tripValue.trim() === "" ? null : Number(tripValue),
        })
        .eq("id", tripId);
      if (updateError) throw updateError;
      router.replace("/driver"); // auto-redirect al completar
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

      {status === "pending_authorization" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/40 bg-red-950/40 px-6 py-10 text-center">
          <p className="text-lg font-bold text-red-300">
            Novedad reportada. Esperando autorización del panel de control para iniciar ruta.
          </p>
          <p className="text-sm text-red-200/80">
            No podrás iniciar el viaje hasta que un administrador autorice la excepción o envíe la unidad a mantenimiento.
          </p>
        </div>
      )}

      {status in ACTIONS && (
        <BigButton loading={loading} onClick={() => runAction(status)}>
          {ACTIONS[status].label}
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

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Datos de facturación (opcional, puedes completarlos después)
            </p>
            <label className="text-sm font-medium text-slate-300">N° de Factura</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            />
            <label className="mt-2 text-sm font-medium text-slate-300">Valor del Viaje</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={tripValue}
              onChange={(e) => setTripValue(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
            />
          </div>

          <BigButton type="submit" loading={loading}>Finalizar Viaje</BigButton>
        </form>
      )}

      {status === "completed" && (
        <p className="text-slate-300">Viaje completado. Redirigiendo al inicio…</p>
      )}
    </div>
  );
}
