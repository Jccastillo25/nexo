// Cookie de la terminal enrolada (enrolamiento de terminales, 2026-10-17).
// Solo de servidor: la importan page.tsx y actions.ts, nunca un archivo
// "use client". El token vive únicamente en esta cookie httpOnly; no se
// devuelve al navegador en ninguna respuesta ni se registra en logs.

import { cookies } from "next/headers";

const NOMBRE = "nexo_terminal";

// `path` literal: el basePath (/rrhh) no se aplica a las cookies.
const OPCIONES = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/rrhh/kiosco",
  maxAge: 400 * 24 * 60 * 60,
};

/** Token guardado en esta terminal, o `null` si no hay cookie. */
export async function leerTokenTerminal(): Promise<string | null> {
  const valor = (await cookies()).get(NOMBRE)?.value;
  return valor ? valor : null;
}

/** Guarda (o renueva) el token. Solo en Server Actions. */
export async function guardarTokenTerminal(token: string): Promise<void> {
  (await cookies()).set(NOMBRE, token, OPCIONES);
}

/**
 * Quita el token de una terminal revocada. No borra la cookie: la deja con un
 * valor inútil, al que estado_terminal responde sin_asignar, así que al
 * recargar la página muestra "Terminal sin asignar". Desde que se retiró el
 * modo heredado por variable de entorno (2026-10-20), sin cookie la página
 * llega a la misma pantalla. Solo en Server Actions.
 */
export async function borrarTokenTerminal(): Promise<void> {
  (await cookies()).set(NOMBRE, "revocado", OPCIONES);
}
