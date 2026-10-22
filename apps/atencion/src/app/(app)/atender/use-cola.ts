"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@nexo/supabase/client";
import { hora } from "@nexo/ui";
import type { Database, TurnoCola } from "@/lib/supabase/database.types";
import { cargarCola } from "../actions";

/**
 * Respaldo por si se cae el WebSocket: solo se sondea mientras el canal NO
 * está en vivo. Con la pestaña en segundo plano Chrome congela los
 * temporizadores (a una vez por minuto o menos); por eso el aviso principal
 * es Realtime, que sí llega en segundo plano.
 */
const RESPALDO_MS = 15000;

/**
 * Agrupa las recargas que llegan juntas (varios eventos de Realtime por una
 * misma acción, foco + visibilidad al volver a la pestaña) en una sola
 * llamada a la Server Action.
 */
const AGRUPAR_MS = 300;

/**
 * Espera máxima del agrupamiento: con un flujo continuo de eventos (cada
 * uno reinicia los AGRUPAR_MS) la fila se recarga igual cada 2 s, en vez de
 * quedarse sin recargar mientras duren los eventos.
 */
const ESPERA_MAXIMA_MS = 2000;

/**
 * Fila del día de la sucursal de la sesión. Se recarga cuando cambia un turno
 * de la sucursal (Realtime sobre public.atencion_cola_senales, migración
 * 20261015162540), al volver a la pestaña o a la ventana y, solo sin conexión
 * en vivo, cada RESPALDO_MS. `onNuevos` recibe los turnos que entraron a la
 * espera desde la carga anterior (no se llama en la primera carga).
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
  // Hora del servidor menos hora local, para los cronómetros.
  const [desfase, setDesfase] = useState(0);
  const conocidos = useRef<Set<string> | null>(null);
  // Solo la respuesta de la última recarga pedida se aplica (evita que una
  // respuesta lenta pise a una más nueva).
  const ultimaPedida = useRef(0);
  const avisar = useRef(onNuevos);
  useEffect(() => {
    avisar.current = onNuevos;
  });

  const recargar = useCallback(async () => {
    const pedida = ++ultimaPedida.current;
    const res = await cargarCola();
    if (pedida !== ultimaPedida.current) return;
    if (!res.ok) {
      setError(res.message ?? "No se pudo cargar la fila.");
      return;
    }
    const data = res.data?.turnos ?? [];
    if (res.data) setDesfase(Date.parse(res.data.ahora) - Date.now());
    const esperando = data.filter((t) => t.estado === "esperando");
    if (conocidos.current) {
      const nuevos = esperando.filter((t) => !conocidos.current!.has(t.id));
      if (nuevos.length > 0) avisar.current?.(nuevos);
    }
    conocidos.current = new Set(data.map((t) => t.id));
    setCola(data);
    setError(null);
  }, []);

  // Carga inicial, Realtime y regreso a la pestaña/ventana.
  useEffect(() => {
    let activo = true;
    let espera: ReturnType<typeof setTimeout> | null = null;
    // Instante del primer evento todavía sin recargar (para ESPERA_MAXIMA_MS).
    let pendienteDesde: number | null = null;
    let conectadoAntes = false;

    const cargar = () => {
      if (activo) void recargar();
    };
    const programar = () => {
      if (!activo) return;
      const ahora = Date.now();
      if (pendienteDesde === null) pendienteDesde = ahora;
      if (espera !== null) clearTimeout(espera);
      const restante = pendienteDesde + ESPERA_MAXIMA_MS - ahora;
      espera = setTimeout(
        () => {
          espera = null;
          pendienteDesde = null;
          cargar();
        },
        Math.max(0, Math.min(AGRUPAR_MS, restante))
      );
    };

    // Primera carga sin esperar: el estado se actualiza cuando responde el servidor.
    cargar();

    // focus y visibilitychange suelen llegar juntos al volver: los dos pasan
    // por programar(), así que cargan una sola vez.
    const alVolver = () => {
      if (document.visibilityState === "visible") programar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    window.addEventListener("online", programar);

    const supabase = createBrowserClient<Database>();
    const canal = supabase
      .channel(`atencion-cola-${sucursalId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atencion_cola_senales", filter: `sucursal_id=eq.${sucursalId}` },
        programar
      )
      .subscribe((estado) => {
        if (!activo) return;
        setEnVivo(estado === "SUBSCRIBED");
        if (estado !== "SUBSCRIBED") return;
        // La primera conexión no recarga: la carga inicial de arriba ya salió
        // al montar (antes se pedía la fila dos veces seguidas). Al
        // RE-conectar sí, por si algo cambió mientras no había conexión. Un
        // cambio justo entre la carga inicial y la suscripción se corrige
        // con el siguiente evento (cada uno recarga la fila completa) o al
        // volver a la pestaña.
        if (conectadoAntes) programar();
        conectadoAntes = true;
      });

    return () => {
      activo = false;
      if (espera !== null) clearTimeout(espera);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      window.removeEventListener("online", programar);
      void supabase.removeChannel(canal);
    };
  }, [recargar, sucursalId]);

  // Respaldo: sondeo solo mientras Realtime no está conectado.
  useEffect(() => {
    if (enVivo) return;
    const id = setInterval(() => void recargar(), RESPALDO_MS);
    return () => clearInterval(id);
  }, [enVivo, recargar]);

  return { cola, error, recargar, enVivo, desfase };
}

/** "9:05 a. m." en hora de Managua; vacío sin dato. */
export function horaCorta(iso: string | null) {
  return iso ? hora(iso) : "";
}
