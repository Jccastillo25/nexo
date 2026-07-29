"use client";

import { useRouter } from "next/navigation";

type Vehicle = {
  id: string;
  license_plate: string;
  brand: string | null;
  model: string | null;
  current_odometer: number;
};

export function VehiclePicker({ vehicles }: { vehicles: Vehicle[] }) {
  const router = useRouter();

  if (vehicles.length === 0) {
    return <p className="text-slate-400">No hay unidades disponibles en este momento.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {vehicles.map((vehicle) => (
        <button
          key={vehicle.id}
          onClick={() => router.push(`/driver/trips/new?vehicle=${vehicle.id}`)}
          className="rounded-2xl bg-slate-800 px-5 py-4 text-left active:bg-slate-700"
        >
          <p className="text-lg font-bold text-white">{vehicle.license_plate}</p>
          <p className="text-sm text-slate-400">
            {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Sin marca/modelo"}
          </p>
          <p className="text-sm text-slate-500">
            Odómetro actual: {vehicle.current_odometer.toLocaleString()} km
          </p>
        </button>
      ))}
    </div>
  );
}
