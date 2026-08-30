import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUniquePin } from "@/lib/generate-pin";
import { countDrivers } from "@/lib/company-quota";

export async function POST(request: Request) {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Solo un administrador puede crear conductores." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const nationalId = typeof body?.nationalId === "string" ? body.nationalId.trim() : "";
  const licenseNumber =
    typeof body?.licenseNumber === "string" && body.licenseNumber.trim() ? body.licenseNumber.trim() : null;
  const licenseType =
    typeof body?.licenseType === "string" && body.licenseType.trim() ? body.licenseType.trim() : null;
  const licenseExpiry = typeof body?.licenseExpiry === "string" ? body.licenseExpiry.trim() : "";
  const categoryIds = Array.isArray(body?.categoryIds)
    ? body.categoryIds.filter((c: unknown): c is string => typeof c === "string")
    : [];

  if (!firstName || !lastName || !email || !username || !nationalId || !licenseExpiry) {
    return NextResponse.json(
      { error: "Nombres, apellidos, correo, usuario, identificación y vencimiento de licencia son obligatorios." },
      { status: 400 },
    );
  }
  if (categoryIds.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos una categoría de licencia." }, { status: 400 });
  }
  if (!/^[a-z0-9_.]+$/.test(username)) {
    return NextResponse.json(
      { error: "El usuario solo puede tener letras minúsculas, números, punto y guión bajo." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("max_drivers")
    .eq("id", caller.companyId)
    .single();

  if (company?.max_drivers !== null && company?.max_drivers !== undefined) {
    const total = await countDrivers(admin, caller.companyId);
    if (total >= company.max_drivers) {
      return NextResponse.json(
        { error: "Se alcanzó el límite de conductores permitidos para tu empresa. Contacta a Ruta360 para ampliarlo." },
        { status: 403 },
      );
    }
  }

  const { data: existingUsername } = await admin
    .from("drivers")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existingUsername) {
    return NextResponse.json({ error: "Ese usuario ya está en uso." }, { status: 409 });
  }

  const { data: validCategories } = await admin
    .from("license_categories")
    .select("id")
    .eq("company_id", caller.companyId)
    .in("id", categoryIds);
  if (!validCategories || validCategories.length !== categoryIds.length) {
    return NextResponse.json({ error: "Alguna categoría de licencia no es válida." }, { status: 400 });
  }

  // Conductores no usan contraseña: inician sesión solo con usuario + PIN.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "No se pudo crear el usuario." },
      { status: 400 },
    );
  }

  const pin = await generateUniquePin(admin, caller.companyId);

  const { error: profileError } = await admin.from("drivers").insert({
    id: created.user.id,
    company_id: caller.companyId,
    email,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    username,
    pin_code: pin,
    national_id: nationalId,
    license_number: licenseNumber,
    license_type: licenseType,
    license_expiry: licenseExpiry,
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "No se pudo registrar el perfil del conductor." }, { status: 500 });
  }

  const { error: categoriesError } = await admin
    .from("driver_license_categories")
    .insert(categoryIds.map((categoryId: string) => ({ driver_id: created.user.id, category_id: categoryId })));

  if (categoriesError) {
    await admin.from("drivers").delete().eq("id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "No se pudieron asignar las categorías de licencia." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pin });
}
