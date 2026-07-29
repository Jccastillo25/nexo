import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GENERIC_ERROR = "Correo o PIN incorrectos.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (!email || !pin) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from("users")
    .select("email, pin_code, is_active")
    .eq("email", email)
    .maybeSingle();

  if (!userRow || !userRow.is_active || !userRow.pin_code || userRow.pin_code !== pin) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userRow.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }

  return NextResponse.json({
    email: userRow.email,
    token_hash: linkData.properties.hashed_token,
  });
}
