import { createClient } from "@/lib/supabase/client";

// Cierra el ciclo de trabajo actual del conductor ("Llenado Final de
// Tanque"): crea la liquidación en estado 'draft'. El trigger
// attach_loose_records_to_settlement (migración 0018) engancha
// automáticamente, del lado del servidor, todos los viajes completados y
// anticipos que todavía no pertenecían a ninguna liquidación — el cliente
// no necesita (ni puede, por RLS) tocar driver_advances directamente.
export async function closeCurrentCycle(driverId: string, companyId: string): Promise<void> {
  const supabase = createClient();

  const { data: lastSettlement } = await supabase
    .from("settlements")
    .select("end_date")
    .eq("driver_id", driverId)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const startDate = lastSettlement?.end_date ?? now;

  const { error } = await supabase.from("settlements").insert({
    company_id: companyId,
    driver_id: driverId,
    start_date: startDate,
    end_date: now,
    status: "draft",
  });

  if (error) throw error;
}
