"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadEvidencePhoto } from "@/lib/storage";
import { PhotoCaptureInput } from "@/components/PhotoCaptureInput";
import { BigButton } from "@/components/BigButton";
import { ReportAnomalyModal } from "./ReportAnomalyModal";

type AnomalyCategory = { id: string; name: string; blocks_trip: boolean };

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type === "image/png" ? "png" : "jpg";
}

export function InspectionForm({
  companyId,
  driverId,
  vehicleId,
  anomalyCategories,
}: {
  companyId: string;
  driverId: string;
  vehicleId: string;
  anomalyCategories: AnomalyCategory[];
}) {
  const router = useRouter();
  const [odometer, setOdometer] = useState("");
  const [odometerPhoto, setOdometerPhoto] = useState<File | null>(null);
  const [reportingAnomaly, setReportingAnomaly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateOdometer(): boolean {
    if (!odometer.trim()) {
      setError("Ingresa el odómetro inicial.");
      return false;
    }
    if (!odometerPhoto) {
      setError("La foto del odómetro es obligatoria.");
      return false;
    }
    return true;
  }

  async function createTrip(status: "inspected" | "pending_authorization"): Promise<string> {
    const supabase = createClient();
    const tripId = crypto.randomUUID();

    const odometerPath = await uploadEvidencePhoto(
      odometerPhoto!,
      `${companyId}/${tripId}/start-odometer.${fileExtension(odometerPhoto!)}`,
    );

    const { error: tripError } = await supabase.from("trips").insert({
      id: tripId,
      company_id: companyId,
      vehicle_id: vehicleId,
      driver_id: driverId,
      start_odometer: Number(odometer),
      start_odometer_photo_url: odometerPath,
      status,
    });
    if (tripError) throw tripError;

    return tripId;
  }

  async function handleAllClear() {
    setError(null);
    if (!validateOdometer()) return;

    setSubmitting(true);
    try {
      const tripId = await createTrip("inspected");
      router.push(`/driver/trips/${tripId}`);
    } catch {
      setError("No se pudo registrar la inspección. Verifica tu conexión e inténtalo de nuevo.");
      setSubmitting(false);
    }
  }

  function handleReportAnomalyClick() {
    setError(null);
    if (!validateOdometer()) return;
    setReportingAnomaly(true);
  }

  async function handleAnomalySubmit({
    categoryId,
    blocksTrip,
    description,
    photo,
  }: {
    categoryId: string;
    blocksTrip: boolean;
    description: string;
    photo: File;
  }) {
    const supabase = createClient();
    // Solo una falla mecánica que impide mover la unidad con seguridad
    // bloquea el viaje; lo estético/accesorio queda registrado como
    // evidencia, pero el conductor continúa (definido por categoría).
    const tripId = await createTrip(blocksTrip ? "pending_authorization" : "inspected");

    const photoPath = await uploadEvidencePhoto(
      photo,
      `${companyId}/${tripId}/anomaly.${fileExtension(photo)}`,
    );

    const { error: anomalyError } = await supabase.from("trip_anomalies").insert({
      trip_id: tripId,
      category_id: categoryId,
      description: description.trim() || null,
      photo_url: photoPath,
    });
    if (anomalyError) throw anomalyError;

    router.push(`/driver/trips/${tripId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Odómetro inicial (km)</label>
        <input
          type="number"
          inputMode="numeric"
          required
          min={0}
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-lg text-white"
        />
      </div>

      <PhotoCaptureInput label="Foto del tablero" required onCapture={setOdometerPhoto} />

      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">
          Certifico que la unidad está en condiciones seguras de operación
        </h2>

        {anomalyCategories.length > 0 && (
          <ol className="mb-6 flex flex-col gap-2 text-sm text-slate-300">
            {anomalyCategories.map((c, i) => (
              <li key={c.id}>
                {i + 1}. {c.name}
              </li>
            ))}
          </ol>
        )}

        {error && <p className="mb-4 text-red-400">{error}</p>}

        <div className="flex flex-col gap-3">
          <BigButton variant="success" loading={submitting} onClick={handleAllClear}>
            Todo en Orden - Iniciar Turno
          </BigButton>
          <button
            type="button"
            disabled={submitting}
            onClick={handleReportAnomalyClick}
            className="w-full rounded-2xl border-2 border-red-500 bg-transparent px-6 py-5 text-xl font-bold text-red-400 shadow-lg transition active:bg-red-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reportar Novedad / Daño
          </button>
        </div>
      </div>

      {reportingAnomaly && (
        <ReportAnomalyModal
          categories={anomalyCategories}
          onClose={() => setReportingAnomaly(false)}
          onSubmit={handleAnomalySubmit}
        />
      )}
    </div>
  );
}
