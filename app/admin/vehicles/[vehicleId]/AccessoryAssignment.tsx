"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Accessory = { id: string; name: string };

export function AccessoryAssignment({
  vehicleId,
  accessories,
  initiallyAssignedIds,
}: {
  vehicleId: string;
  accessories: Accessory[];
  initiallyAssignedIds: string[];
}) {
  const [assignedIds, setAssignedIds] = useState(new Set(initiallyAssignedIds));
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function toggle(accessoryId: string) {
    setPendingId(accessoryId);
    const supabase = createClient();
    const isAssigned = assignedIds.has(accessoryId);

    if (isAssigned) {
      await supabase
        .from("vehicle_accessories")
        .delete()
        .eq("vehicle_id", vehicleId)
        .eq("accessory_id", accessoryId);
    } else {
      await supabase
        .from("vehicle_accessories")
        .insert({ vehicle_id: vehicleId, accessory_id: accessoryId });
    }

    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (isAssigned) next.delete(accessoryId);
      else next.add(accessoryId);
      return next;
    });
    setPendingId(null);
  }

  if (accessories.length === 0) {
    return (
      <p className="text-slate-500">
        No hay accesorios en el catálogo todavía. Créalos en la sección Accesorios.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {accessories.map((a) => (
        <label
          key={a.id}
          className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-slate-200"
        >
          <input
            type="checkbox"
            checked={assignedIds.has(a.id)}
            disabled={pendingId === a.id}
            onChange={() => toggle(a.id)}
            className="h-5 w-5"
          />
          {a.name}
        </label>
      ))}
    </div>
  );
}
