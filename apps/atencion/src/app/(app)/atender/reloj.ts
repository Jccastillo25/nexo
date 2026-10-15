"use client";

import { useEffect, useState } from "react";

/** Hora actual corregida con el desfase del servidor, actualizada cada segundo. */
export function useReloj(desfase: number) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return ahora + desfase;
}

/** Milisegundos entre dos instantes ISO (o hasta `hasta` en ms); null si falta el inicio. */
export function transcurrido(desde: string | null, hasta: string | number | null): number | null {
  if (!desde || hasta === null) return null;
  const fin = typeof hasta === "number" ? hasta : Date.parse(hasta);
  return Math.max(0, fin - Date.parse(desde));
}

/** 75 s → "1:15"; 3725 s → "1:02:05". */
export function duracion(ms: number | null): string {
  if (ms === null) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
