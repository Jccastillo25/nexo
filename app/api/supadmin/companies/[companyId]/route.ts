import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/supadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const platformAdmin = await requirePlatformAdmin();
  if (!platformAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { companyId } = await params;
  const body = await request.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ruc = typeof body?.ruc === "string" && body.ruc.trim() ? body.ruc.trim() : null;
  const address = typeof body?.address === "string" && body.address.trim() ? body.address.trim() : null;
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const logoUrl = typeof body?.logoUrl === "string" && body.logoUrl ? body.logoUrl : null;
  const maxUsers = Number.isFinite(Number(body?.maxUsers)) ? Number(body.maxUsers) : null;
  const isActive = Boolean(body?.isActive);

  if (!name) {
    return NextResponse.json({ error: "El nombre de la empresa es obligatorio." }, { status: 400 });
  }
  if (maxUsers === null || maxUsers < 1) {
    return NextResponse.json({ error: "El límite de usuarios debe ser un número mayor a 0." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("companies")
    .update({
      name,
      ruc,
      address,
      phone,
      email,
      logo_url: logoUrl,
      max_users: maxUsers,
      is_active: isActive,
    })
    .eq("id", companyId);

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar la empresa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
