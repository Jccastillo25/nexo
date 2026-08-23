import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettlementEditor } from "./SettlementEditor";

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ settlementId: string }>;
}) {
  const { settlementId } = await params;
  const supabase = await createClient();

  const { data: settlement } = await supabase
    .from("settlements")
    .select(
      "id, start_date, end_date, status, fuel_cost, variable_expenses, total_freight, total_advances, final_payout, driver:drivers(full_name, commission_percentage)",
    )
    .eq("id", settlementId)
    .maybeSingle();

  if (!settlement) redirect("/admin/settlements");

  const [{ data: trips }, { data: advances }] = await Promise.all([
    supabase
      .from("trips")
      .select("id, trip_value, invoice_number, created_at, vehicle:vehicles(license_plate)")
      .eq("settlement_id", settlementId)
      .order("created_at"),
    supabase
      .from("driver_advances")
      .select("id, amount, description, created_at")
      .eq("settlement_id", settlementId)
      .order("created_at"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/settlements" className="text-sm text-slate-400 hover:text-slate-200">
          ← Volver a liquidaciones
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-100">{settlement.driver?.full_name}</h1>
        <p className="text-sm text-slate-400">
          {new Date(settlement.start_date).toLocaleDateString()} –{" "}
          {new Date(settlement.end_date).toLocaleDateString()}
        </p>
      </div>

      <SettlementEditor
        settlement={settlement}
        trips={trips ?? []}
        advances={advances ?? []}
        commissionPercentage={settlement.driver?.commission_percentage ?? 0}
      />
    </div>
  );
}
