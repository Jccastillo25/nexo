import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/supadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const platformAdmin = await requirePlatformAdmin();
  if (!platformAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
  const ruc = typeof body?.ruc === "string" && body.ruc.trim() ? body.ruc.trim() : null;
  const address = typeof body?.address === "string" && body.address.trim() ? body.address.trim() : null;
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const companyEmail =
    typeof body?.companyEmail === "string" && body.companyEmail.trim() ? body.companyEmail.trim() : null;
  const maxUsers = Number.isFinite(Number(body?.maxUsers)) ? Number(body.maxUsers) : null;
  const maxDrivers = Number.isFinite(Number(body?.maxDrivers)) ? Number(body.maxDrivers) : null;

  const adminFullName = typeof body?.adminFullName === "string" ? body.adminFullName.trim() : "";
  const adminEmail = typeof body?.adminEmail === "string" ? body.adminEmail.trim().toLowerCase() : "";
  const adminPassword = typeof body?.adminPassword === "string" ? body.adminPassword : "";

  if (!companyName) {
    return NextResponse.json({ error: "El nombre de la empresa es obligatorio." }, { status: 400 });
  }
  if (!adminFullName || !adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: "Nombre, correo y contraseña del administrador son obligatorios." },
      { status: 400 },
    );
  }
  if (adminPassword.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (maxUsers === null || maxUsers < 1) {
    return NextResponse.json({ error: "El límite de administradores debe ser un número mayor a 0." }, { status: 400 });
  }
  if (maxDrivers === null || maxDrivers < 1) {
    return NextResponse.json({ error: "El límite de conductores debe ser un número mayor a 0." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: companyName,
      ruc,
      address,
      phone,
      email: companyEmail,
      max_users: maxUsers,
      max_drivers: maxDrivers,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: "No se pudo crear la empresa." }, { status: 500 });
  }

  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (createUserError || !created.user) {
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json(
      { error: createUserError?.message ?? "No se pudo crear el usuario administrador." },
      { status: 400 },
    );
  }

  const { error: profileError } = await admin.from("admins").insert({
    id: created.user.id,
    company_id: company.id,
    email: adminEmail,
    full_name: adminFullName,
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("companies").delete().eq("id", company.id);
    return NextResponse.json({ error: "No se pudo registrar el administrador de la empresa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, companyId: company.id });
}
