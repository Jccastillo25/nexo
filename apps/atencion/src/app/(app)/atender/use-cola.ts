"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TurnoCola } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { cargarCola } from "../actions";

/**
 * Respaldo por si se cae el WebSocket. Con la pestaña en segundo plano Chrome
 * lo congela (a una vez por minuto o menos); por eso el aviso principal es
 * Realtime, que sí llega en segundo plano.
 */
const RESPALDO_MS = 15000;

/**
 * Fila del día de la sucursal de la sesión. Se recarga al instante cuando
 * cambia un turno de la sucursal (Realtime sobre public.atencion_cola_senales,
 * migración 20261015162540), al volver a la pestaña y, como respaldo, cada
 * RESPALDO_MS. `onNuevos` recibe los turnos que entraron a la espera desde la
 * carga anterior (no se llama en la primera carga).
 */
export function useCola({
  sucursalId,
  onNuevos,
}: {
  sucursalId: string;
  onNuevos?: (nuevos: TurnoCola[]) => void;
}) {
  const [cola, setCola] = useState<TurnoCola[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enVivo, setEnVivo] = useState(false);
  const conocidos = useRef<Set<string> | null>(null);
  const avisar = useRef(onNuevos);
  useEffect(() => {
    avisar.current = onNuevos;
  });

  const recargar = useCallback(async () => {
    const res = await cargarCola();
    if (!res.ok) {
      setError(res.message ?? "No se pudo cargar la fila.");
      return;
    }
    const data = res.data ?? [];
    const esperando = data.filter((t) => t.estado === "esperando");
    if (conocidos.current) {
      const nuevos = esperando.filter((t) => !conocidos.current!.has(t.id));
      if (nuevos.length > 0) avisar.current?.(nuevos);
    }
    conocidos.current = new Set(data.map((t) => t.id));
    setCola(data);
    setError(null);
  }, []);

  useEffect(() => {
    let activo = true;
    const tick = () => {
      if (activo) void recargar();
    };
    tick();
    const id = setInterval(tick, RESPALDO_MS);

    const alVolver = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);

    const supabase = createClient();
    const canal = supabase
      .channel(`atencion-cola-${sucursalId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atencion_cola_senales", filter: `sucursal_id=eq.${sucursalId}` },
        tick
      )
      .subscribe((estado) => {
        if (!activo) return;
        setEnVivo(estado === "SUBSCRIBED");
        // Al (re)conectar se recarga por si algo cambió mientras no había conexión.
        if (estado === "SUBSCRIBED") tick();
      });

    return () => {
      activo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
      void supabase.removeChannel(canal);
    };
  }, [recargar, sucursalId]);

  return { cola, error, recargar, enVivo };
}

export function horaCorta(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" });
}
