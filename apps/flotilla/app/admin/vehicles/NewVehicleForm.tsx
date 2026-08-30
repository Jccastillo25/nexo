"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewVehicleForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [licensePlate, setLicensePlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [currentOdometer, setCurrentOdometer] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("vehicles").insert({
      company_id: companyId,
      license_plate: licensePlate.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      current_odometer: Number(currentOdometer) || 0,
    });

    setSubmitting(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Ya existe un vehículo con esa placa."
          : "No se pudo registrar el vehículo.",
      );
      return;
    }

    setLicensePlate("");
    setBrand("");
    setModel("");
    setCurrentOdometer("0");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl bg-slate-900 p-4">
      <input
        type="text"
        placeholder="Placa"
        required
        value={licensePlate}
        onChange={(e) => setLicensePlate(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Marca"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="w-1/2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        <input
          type="text"
          placeholder="Modelo"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-1/2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>
      <input
        type="number"
        placeholder="Odómetro actual (km)"
        min={0}
        value={currentOdometer}
        onChange={(e) => setCurrentOdometer(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-900 disabled:opacity-50"
      >
        {submitting ? "Guardando..." : "Registrar vehículo"}
      </button>
    </form>
  );
}
