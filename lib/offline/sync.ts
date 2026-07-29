import { createClient } from "@/lib/supabase/client";
import { getPendingEvents, removePendingEvent } from "./db";

// Reintenta el envío de eventos encolados mientras estuvo offline.
// Se marca synced_offline=true porque el timestamp/GPS vienen del reloj
// del dispositivo, capturados en el momento real del evento, no del servidor.
export async function flushPendingEvents(): Promise<{ synced: number; remaining: number }> {
  const pending = await getPendingEvents();
  if (pending.length === 0) return { synced: 0, remaining: 0 };

  const supabase = createClient();
  let synced = 0;

  for (const event of pending) {
    const { localId, ...row } = event;
    const { error } = await supabase.from("trip_events").insert({
      trip_id: row.trip_id,
      event_type: row.event_type,
      recorded_at: row.recorded_at,
      latitude: row.latitude,
      longitude: row.longitude,
      gps_accuracy: row.gps_accuracy,
      synced_offline: true,
    });

    if (!error) {
      await removePendingEvent(localId);
      synced += 1;
    } else {
      // Se detiene en el primer fallo (probablemente seguimos sin red);
      // el resto de la cola se reintenta en el próximo trigger de sync.
      break;
    }
  }

  const stillPending = await getPendingEvents();
  return { synced, remaining: stillPending.length };
}
