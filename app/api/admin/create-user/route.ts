import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", caller.id)
    .maybeSingle();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede crear usuarios." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const role = body?.role === "admin" ? "admin" : "driver";
  const pinCode = typeof body?.pinCode === "string" && body.pinCode.trim() ? body.pinCode.trim() : null;

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Correo, contraseña y nombre son obligatorios." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (pinCode && !/^\d{4}$/.test(pinCode)) {
    return NextResponse.json({ error: "El PIN debe ser de 4 dígitos." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("max_users")
    .eq("id", callerProfile.company_id)
    .single();

  if (company?.max_users !== null && company?.max_users !== undefined) {
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", callerProfile.company_id);

    if ((count ?? 0) >= company.max_users) {
      return NextResponse.json(
        { error: "Se alcanzó el límite de usuarios permitidos para tu empresa. Contacta a Ruta360 para ampliarlo." },
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

  // company_id se toma del admin que hace la llamada, nunca del body:
  // evita que alguien cree usuarios en una empresa que no es la suya.
  const { error: profileError } = await admin.from("users").insert({
    id: created.user.id,
    company_id: callerProfile.company_id,
    email,
    full_name: fullName,
    role,
    pin_code: pinCode,
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "No se pudo registrar el perfil del usuario." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
