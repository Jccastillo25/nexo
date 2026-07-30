import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { countAdmins } from "@/lib/company-quota";

export async function POST(request: Request) {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Solo un administrador puede crear administradores." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: "Nombre, correo y contraseña son obligatorios." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("max_users")
    .eq("id", caller.companyId)
    .single();

  if (company?.max_users !== null && company?.max_users !== undefined) {
    const total = await countAdmins(admin, caller.companyId);
    if (total >= company.max_users) {
      return NextResponse.json(
        { error: "Se alcanzó el límite de administradores permitidos para tu empresa. Contacta a Ruta360 para ampliarlo." },
        { status: 403 },
      );
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "No se pudo crear el usuario." },
      { status: 400 },
    );
  }

  const { error: profileError } = await admin.from("admins").insert({
    id: created.user.id,
    company_id: caller.companyId,
    email,
    full_name: fullName,
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "No se pudo registrar el perfil del administrador." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
