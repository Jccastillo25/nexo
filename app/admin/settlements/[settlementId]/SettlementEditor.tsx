"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Trip = {
  id: string;
  trip_value: number | null;
  invoice_number: string | null;
  created_at: string | null;
  vehicle: { license_plate: string } | null;
};

type Advance = { id: string; amount: number; description: string | null; created_at: string | null };

type Settlement = {
  id: string;
  status: "draft" | "completed";
  fuel_cost: number;
  variable_expenses: number;
  total_freight: number | null;
  total_advances: number | null;
  final_payout: number | null;
};

// Fórmula de liquidación (documento de especificación del usuario):
// Ingreso Bruto = Σ trip_value
// Base Comisionable = Ingreso Bruto − (fuel_cost + variable_expenses)
// Comisión Neta = Base Comisionable × (commission_percentage / 100)
// Total a Pagar = Comisión Neta − Σ driver_advances
export function SettlementEditor({
  settlement,
  trips,
  advances,
  commissionPercentage,
}: {
  settlement: Settlement;
  trips: Trip[];
  advances: Advance[];
  commissionPercentage: number;
}) {
  const router = useRouter();
  const sealed = settlement.status === "completed";

  const [fuelCost, setFuelCost] = useState(String(settlement.fuel_cost));
  const [variableExpenses, setVariableExpenses] = useState(String(settlement.variable_expenses));
  const [error, setError] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);

  const grossIncome = useMemo(
    () => trips.reduce((sum, t) => sum + (t.trip_value ?? 0), 0),
    [trips],
  );
  const totalAdvances = useMemo(() => advances.reduce((sum, a) => sum + a.amount, 0), [advances]);

  const fuel = sealed ? settlement.fuel_cost : Number(fuelCost) || 0;
  const variable = sealed ? settlement.variable_expenses : Number(variableExpenses) || 0;
  const commissionableBase = grossIncome - (fuel + variable);
  const netCommission = commissionableBase * (commissionPercentage / 100);
  const finalPayout = sealed ? (settlement.final_payout ?? 0) : netCommission - totalAdvances;

  async function handleSeal() {
    setError(null);
    setSealing(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("settlements")
      .update({
        fuel_cost: fuel,
        variable_expenses: variable,
        total_freight: grossIncome,
        total_advances: totalAdvances,
        final_payout: finalPayout,
        status: "completed",
        sealed_at: new Date().toISOString(),
      })
      .eq("id", settlement.id);
    setSealing(false);
    if (updateError) {
      setError("No se pudo sellar la liquidación.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Fletes ({trips.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Vehículo</th>
                <th className="px-3 py-2">Factura</th>
                <th className="px-3 py-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-400">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2">{t.vehicle?.license_plate}</td>
                  <td className="px-3 py-2">{t.invoice_number ?? "—"}</td>
                  <td className="px-3 py-2">{t.trip_value !== null ? `$${t.trip_value.toLocaleString()}` : "—"}</td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                    Sin viajes en este ciclo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {advances.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Anticipos ({advances.length})
          </h2>
          <div className="flex flex-col gap-2">
            {advances.map((a) => (
              <div key={a.id} className="flex justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm">
                <span className="text-slate-300">{a.description || "Anticipo"}</span>
                <span className="font-semibold text-white">${a.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Cálculo de liquidación
        </h2>

        <div className="flex flex-col gap-3">
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm text-slate-300">Combustible</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                disabled={sealed}
                value={sealed ? settlement.fuel_cost : fuelCost}
                onChange={(e) => setFuelCost(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm text-slate-300">Otros gastos variables</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                disabled={sealed}
                value={sealed ? settlement.variable_expenses : variableExpenses}
                onChange={(e) => setVariableExpenses(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
              />
            </div>
          </div>

          <dl className="mt-2 flex flex-col gap-1 text-sm">
            <Row label="Ingreso Bruto" value={grossIncome} />
            <Row label="Base Comisionable" value={commissionableBase} />
            <Row label={`Comisión Neta (${commissionPercentage}%)`} value={netCommission} />
            <Row label="Anticipos" value={-totalAdvances} />
            <Row label="Total a Pagar" value={finalPayout} emphasize />
          </dl>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {!sealed ? (
            <button
              type="button"
              disabled={sealing}
              onClick={handleSeal}
              className="mt-2 rounded-xl bg-emerald-500 px-6 py-4 text-lg font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sealing ? "Sellando..." : "Sellar Liquidación"}
            </button>
          ) : (
            <a
              href={`/api/admin/settlements/${settlement.id}/pdf`}
              className="mt-2 inline-block rounded-xl bg-amber-400 px-6 py-4 text-center text-lg font-bold text-slate-900"
            >
              Descargar PDF
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div
      className={`flex justify-between border-t border-slate-700 pt-1 first:border-t-0 first:pt-0 ${
        emphasize ? "text-base font-bold text-white" : "text-slate-300"
      }`}
    >
      <span>{label}</span>
      <span>${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
    </div>
  );
}
