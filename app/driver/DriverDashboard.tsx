"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { closeCurrentCycle } from "@/lib/settlements";
import { VehiclePicker } from "./VehiclePicker";

type Vehicle = {
  id: string;
  license_plate: string;
  brand: string | null;
  model: string | null;
  current_odometer: number;
};

type AssignedVehicle = {
  id: string;
  license_plate: string;
  brand: string | null;
  model: string | null;
  status: "active" | "maintenance" | "inactive" | null;
};

export function DriverDashboard({
  driverId,
  companyId,
  assignedVehicle,
  vehicles,
  cycleSummary,
}: {
  driverId: string;
  companyId: string;
  assignedVehicle: AssignedVehicle | null;
  vehicles: Vehicle[];
  cycleSummary: { count: number; totalValue: number };
}) {
  const router = useRouter();
  const [pickingVehicle, setPickingVehicle] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignedIsUsable = assignedVehicle?.status === "active";
  const showPicker = pickingVehicle || !assignedIsUsable;

  async function handleCloseCycle() {
    setError(null);
    setClosing(true);
    try {
      await closeCurrentCycle(driverId, companyId);
      setConfirmingClose(false);
      router.refresh();
    } catch {
      setError("No se pudo cerrar el ciclo. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="inline-block rounded-full bg-emerald-500/20 px-4 py-1 text-sm font-semibold text-emerald-400">
          Disponible
        </p>
      </div>

      {assignedVehicle && (
        <div className="rounded-2xl bg-slate-800 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tu unidad
          </p>
          <p className="text-lg font-bold text-white">{assignedVehicle.license_plate}</p>
          <p className="text-sm text-slate-400">
            {[assignedVehicle.brand, assignedVehicle.model].filter(Boolean).join(" ") ||
              "Sin marca/modelo"}
          </p>
          {!assignedIsUsable && (
            <p className="mt-2 text-sm text-amber-400">
              No disponible ahora mismo (
              {assignedVehicle.status === "maintenance" ? "en mantenimiento" : "inactiva"}) —
              elige otra unidad abajo.
            </p>
          )}
        </div>
      )}

      {assignedIsUsable && !showPicker && (
        <div className="flex flex-col gap-3">
          <BigButton onClick={() => router.push(`/driver/trips/new?vehicle=${assignedVehicle!.id}`)}>
            Iniciar Nuevo Viaje
          </BigButton>
          <button
            type="button"
            onClick={() => setPickingVehicle(true)}
            className="text-sm font-semibold text-slate-400 underline underline-offset-2"
          >
            Cambiar vehículo
          </button>
        </div>
      )}

      {showPicker && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-300">Selecciona tu unidad</h2>
          <VehiclePicker vehicles={vehicles} />
          {assignedIsUsable && (
            <button
              type="button"
              onClick={() => setPickingVehicle(false)}
              className="text-sm font-semibold text-slate-400 underline underline-offset-2"
            >
              Usar mi unidad asignada
            </button>
          )}
        </div>
      )}

      {cycleSummary.count > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ciclo actual
          </p>
          <p className="text-lg font-bold text-white">
            {cycleSummary.count} viaje{cycleSummary.count === 1 ? "" : "s"} sin liquidar
          </p>
          {cycleSummary.totalValue > 0 && (
            <p className="text-sm text-slate-400">
              Total fletes: ${cycleSummary.totalValue.toLocaleString()}
            </p>
          )}

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          {!confirmingClose ? (
            <button
              type="button"
              onClick={() => setConfirmingClose(true)}
              className="mt-4 w-full rounded-xl bg-slate-700 px-4 py-3 text-sm font-bold text-slate-100 active:bg-slate-600"
            >
              Llenado Final de Tanque
            </button>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-sm text-slate-300">
                Esto cierra tu ciclo actual y lo envía a liquidar. ¿Confirmar?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingClose(false)}
                  disabled={closing}
                  className="flex-1 rounded-xl bg-slate-700 px-4 py-3 text-sm font-bold text-slate-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCloseCycle}
                  disabled={closing}
                  className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {closing ? "Procesando..." : "Confirmar cierre"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
