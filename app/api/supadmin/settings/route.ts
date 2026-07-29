import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/supadmin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const platformAdmin = await requirePlatformAdmin();
  if (!platformAdmin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const productName = typeof body?.productName === "string" ? body.productName.trim() : "";
  const logoUrl = typeof body?.logoUrl === "string" && body.logoUrl ? body.logoUrl : null;
  const copyrightText =
    typeof body?.copyrightText === "string" && body.copyrightText.trim()
      ? body.copyrightText.trim()
      : null;

  if (!productName) {
    return NextResponse.json({ error: "El nombre del producto es obligatorio." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("platform_settings")
    .update({
      product_name: productName,
      logo_url: logoUrl,
      copyright_text: copyrightText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: "No se pudo guardar la configuración." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
