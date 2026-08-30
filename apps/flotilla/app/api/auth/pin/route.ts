import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GENERIC_ERROR = "Usuario o PIN incorrectos.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (!username || !pin) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: driverRow } = await admin
    .from("drivers")
    .select("email, pin_code, is_active")
    .ilike("username", username)
    .maybeSingle();

  if (!driverRow || !driverRow.is_active || driverRow.pin_code !== pin) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: driverRow.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }

  return NextResponse.json({
    email: driverRow.email,
    token_hash: linkData.properties.hashed_token,
  });
}
