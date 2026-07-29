"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];

const STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "maintenance", label: "En mantenimiento" },
  { value: "inactive", label: "Inactivo" },
];

export function VehicleStatusForm({
  vehicleId,
  status,
}: {
  vehicleId: string;
  status: VehicleStatus;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleChange(newStatus: VehicleStatus) {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("vehicles").update({ status: newStatus }).eq("id", vehicleId);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          disabled={saving}
          onClick={() => handleChange(opt.value)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
            status === opt.value
              ? "bg-amber-400 text-slate-900"
              : "bg-slate-900 text-slate-300 hover:bg-slate-800"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
