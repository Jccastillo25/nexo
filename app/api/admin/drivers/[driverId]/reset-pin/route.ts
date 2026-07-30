import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUniquePin } from "@/lib/generate-pin";

export async function POST(_request: Request, { params }: { params: Promise<{ driverId: string }> }) {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Solo un administrador puede restablecer el PIN." }, { status: 403 });
  }

  const { driverId } = await params;
  const admin = createAdminClient();

  const { data: driver } = await admin
    .from("drivers")
    .select("company_id")
    .eq("id", driverId)
    .maybeSingle();

  if (!driver || driver.company_id !== caller.companyId) {
    return NextResponse.json({ error: "Conductor no encontrado." }, { status: 404 });
  }

  const pin = await generateUniquePin(admin, caller.companyId);

  const { error } = await admin.from("drivers").update({ pin_code: pin }).eq("id", driverId);
  if (error) {
    return NextResponse.json({ error: "No se pudo restablecer el PIN." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pin });
}
