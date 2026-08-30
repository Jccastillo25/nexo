import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Administradores y conductores tienen cupos independientes
// (companies.max_users / companies.max_drivers): nunca se suman entre sí.
export async function countAdmins(admin: SupabaseClient<Database>, companyId: string): Promise<number> {
  const { count } = await admin
    .from("admins")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  return count ?? 0;
}

export async function countDrivers(admin: SupabaseClient<Database>, companyId: string): Promise<number> {
  const { count } = await admin
    .from("drivers")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  return count ?? 0;
}
