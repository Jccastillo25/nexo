"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadEvidencePhoto } from "@/lib/storage";
import { PhotoCaptureInput } from "@/components/PhotoCaptureInput";
import { BigButton } from "@/components/BigButton";

type Accessory = { id: string; name: string };

type ChecklistItem = {
  isPresent: boolean;
  hasDamage: boolean;
  issueDescription: string;
  issuePhoto: File | null;
};

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type === "image/png" ? "png" : "jpg";
}

export function InspectionForm({
  companyId,
  driverId,
  vehicleId,
  accessories,
}: {
  companyId: string;
  driverId: string;
  vehicleId: string;
  accessories: Accessory[];
}) {
  const router = useRouter();
  const [odometer, setOdometer] = useState("");
  const [odometerPhoto, setOdometerPhoto] = useState<File | null>(null);
  const [checklist, setChecklist] = useState<Record<string, ChecklistItem>>(
    Object.fromEntries(
      accessories.map((a) => [
        a.id,
        { isPresent: true, hasDamage: false, issueDescription: "", issuePhoto: null },
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateItem(accessoryId: string, patch: Partial<ChecklistItem>) {
    setChecklist((prev) => ({ ...prev, [accessoryId]: { ...prev[accessoryId], ...patch } }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!odometerPhoto) {
      setError("La foto del odómetro es obligatoria.");
      return;
    }

    const flaggedWithoutEvidence = accessories.find((a) => {
      const item = checklist[a.id];
      return (!item.isPresent || item.hasDamage) && (!item.issuePhoto || !item.issueDescription.trim());
    });
    if (flaggedWithoutEvidence) {
      setError(
        `"${flaggedWithoutEvidence.name}" está marcado como faltante/dañado: requiere foto y descripción.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const tripId = crypto.randomUUID();

      const odometerPath = await uploadEvidencePhoto(
        odometerPhoto,
        `${companyId}/${tripId}/start-odometer.${fileExtension(odometerPhoto)}`,
      );

      const { error: tripError } = await supabase.from("trips").insert({
        id: tripId,
        company_id: companyId,
        vehicle_id: vehicleId,
        driver_id: driverId,
        start_odometer: Number(odometer),
        start_odometer_photo_url: odometerPath,
        status: "created",
      });
      if (tripError) throw tripError;

      const inspectionRows = await Promise.all(
        accessories.map(async (a) => {
          const item = checklist[a.id];
          const issuePhotoPath = item.issuePhoto
            ? await uploadEvidencePhoto(
                item.issuePhoto,
                `${companyId}/${tripId}/inspection-${a.id}.${fileExtension(item.issuePhoto)}`,
              )
            : null;

          return {
            trip_id: tripId,
            accessory_id: a.id,
            is_present: item.isPresent,
            has_damage: item.hasDamage,
            issue_description: item.issueDescription || null,
            issue_photo_url: issuePhotoPath,
          };
        }),
      );

      if (inspectionRows.length > 0) {
        const { error: inspectionError } = await supabase
          .from("trip_inspections")
          .insert(inspectionRows);
        if (inspectionError) throw inspectionError;
      }

      const { error: statusError } = await supabase
        .from("trips")
        .update({ status: "inspected" })
        .eq("id", tripId);
      if (statusError) throw statusError;

      router.push(`/driver/trips/${tripId}`);
    } catch {
      setError("No se pudo registrar la inspección. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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

      {accessories.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-100">Checklist de accesorios</h2>
          {accessories.map((a) => {
            const item = checklist[a.id];
            const flagged = !item.isPresent || item.hasDamage;
            return (
              <div key={a.id} className="rounded-xl bg-slate-800 p-4">
                <p className="mb-3 font-semibold text-white">{a.name}</p>
                <div className="mb-3 flex gap-4">
                  <label className="flex items-center gap-2 text-slate-200">
                    <input
                      type="checkbox"
                      checked={item.isPresent}
                      onChange={(e) => updateItem(a.id, { isPresent: e.target.checked })}
                      className="h-5 w-5"
                    />
                    Presente
                  </label>
                  <label className="flex items-center gap-2 text-slate-200">
                    <input
                      type="checkbox"
                      checked={item.hasDamage}
                      onChange={(e) => updateItem(a.id, { hasDamage: e.target.checked })}
                      className="h-5 w-5"
                    />
                    Dañado
                  </label>
                </div>

                {flagged && (
                  <div className="flex flex-col gap-3">
                    <textarea
                      placeholder="Describe el problema"
                      required
                      value={item.issueDescription}
                      onChange={(e) => updateItem(a.id, { issueDescription: e.target.value })}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />
                    <PhotoCaptureInput
                      label="Foto del problema"
                      required
                      onCapture={(file) => updateItem(a.id, { issuePhoto: file })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}

      <BigButton type="submit" loading={submitting}>
        Iniciar inspección
      </BigButton>
    </form>
  );
}
