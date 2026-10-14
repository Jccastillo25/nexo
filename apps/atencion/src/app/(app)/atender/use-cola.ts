"use client";

import { useCallback, useEffect, useState } from "react";
import type { TurnoCola } from "@/lib/supabase/database.types";
import { cargarCola } from "../actions";

const INTERVALO_MS = 4000;

/** Fila del día de la sucursal de la sesión, refrescada cada pocos segundos. */
export function useCola() {
  const [cola, setCola] = useState<TurnoCola[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const res = await cargarCola();
    if (res.ok) {
      setCola(res.data ?? []);
      setError(null);
    } else {
      setError(res.message ?? "No se pudo cargar la fila.");
    }
  }, []);

  useEffect(() => {
    let activo = true;
    const tick = async () => {
      if (activo) await recargar();
    };
    tick();
    const id = setInterval(tick, INTERVALO_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [recargar]);

  return { cola, error, recargar };
}

export function horaCorta(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" });
}
