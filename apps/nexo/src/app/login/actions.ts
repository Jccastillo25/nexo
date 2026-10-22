"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@nexo/supabase";
import type { Database } from "@/lib/supabase/database.types";

export type LoginState = { error: string | null };

// Origen ficticio para resolver `next` como URL relativa: si al resolverla el
// origen cambia, `next` apuntaba a otro sitio.
const ORIGEN_INTERNO = "http://x.invalid";
const NEXT_MAX = 2048;

/** Caracteres de control (U+0000–U+001F, U+007F) o barra invertida. */
function tieneCaracterProhibido(valor: string): boolean {
  for (let i = 0; i < valor.length; i++) {
    const codigo = valor.charCodeAt(i);
    if (codigo <= 0x1f || codigo === 0x7f || codigo === 0x5c) return true;
  }
  return false;
}

/**
 * Solo rutas internas del mismo origen; cualquier otra cosa vuelve a "/"
 * (N8, revisión 2026-10-20). Se revisa el valor tal como llega y también una
 * vez decodificado:
 * - el navegador quita tabuladores y saltos de línea de una URL, así que
 *   "/\t/evil.com" (o "/%09/evil.com" decodificado) acaba como "//evil.com";
 * - "\" equivale a "/" para el navegador ("/\evil.com" → "//evil.com");
 * - "//host" es una URL de otro sitio sin esquema.
 * Al final se resuelve con `new URL` contra un origen ficticio: si el origen
 * cambia, se rechaza. También se rechaza si la ruta resuelta empieza con "//"
 * ("/a/..//evil.com"): si algo la normalizara antes de redirigir, quedaría
 * "//evil.com". Se devuelve el valor original, que el navegador resuelve en
 * el mismo origen.
 */
function destinoSeguro(next: string): string {
  if (next.length === 0 || next.length > NEXT_MAX) return "/";

  let decodificado: string;
  try {
    decodificado = decodeURIComponent(next);
  } catch {
    return "/";
  }

  for (const valor of [next, decodificado]) {
    if (tieneCaracterProhibido(valor)) return "/";
    if (!valor.startsWith("/") || valor.startsWith("//")) return "/";
  }

  let url: URL;
  try {
    url = new URL(next, ORIGEN_INTERNO);
  } catch {
    return "/";
  }
  if (url.origin !== ORIGEN_INTERNO || url.pathname.startsWith("//")) return "/";

  return next;
}

export async function signIn(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Ingresa correo y contraseña." };
  }

  const supabase = await createServerClient<Database>();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  // Contraseña temporal puesta por un administrador -> primero la cambia.
  const { data: perfil } = await supabase.rpc("mi_perfil");
  if (perfil?.[0]?.debe_cambiar_password) redirect("/cambiar-contrasena");

  redirect(destinoSeguro(next));
}

// El cierre de sesión vive en el kernel: signOut de @nexo/auth (desde
// 2026-10-20), el mismo que usan los módulos.
