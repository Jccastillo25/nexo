import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// PIN de 4 dígitos único dentro de la empresa (unique index a nivel de
// DB como respaldo; este loop evita depender solo del error de colisión).
export async function generateUniquePin(
  admin: SupabaseClient<Database>,
  companyId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = String(Math.floor(1000 + Math.random() * 9000));
    const { data } = await admin
      .from("drivers")
      .select("id")
      .eq("company_id", companyId)
      .eq("pin_code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("No se pudo generar un PIN único.");
}

