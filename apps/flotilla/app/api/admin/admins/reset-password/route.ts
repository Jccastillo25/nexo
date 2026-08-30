import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Solo un administrador puede restablecer contraseñas." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const adminId = typeof body?.adminId === "string" ? body.adminId : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!adminId || !password) {
    return NextResponse.json({ error: "Administrador y contraseña son obligatorios." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("admins")
    .select("company_id")
    .eq("id", adminId)
    .maybeSingle();

  if (!target || target.company_id !== caller.companyId) {
    return NextResponse.json({ error: "Administrador no encontrado." }, { status: 404 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(adminId, { password });

  if (updateError) {
    return NextResponse.json({ error: "No se pudo restablecer la contraseña." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
