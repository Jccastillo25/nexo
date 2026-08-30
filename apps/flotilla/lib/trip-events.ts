import { createClient } from "@/lib/supabase/client";
import { getCurrentPosition } from "@/lib/geolocation";
import { queuePendingEvent } from "@/lib/offline/db";
import type { Database } from "@/lib/supabase/database.types";

type TripEventType = Database["public"]["Enums"]["trip_event_type"];

export class TripEventError extends Error {}

// Captura GPS + timestamp local en el instante del botón (evidencia real del
// hecho) e intenta escribir el evento inmutable. Si no hay red, o la
// escritura falla a nivel de transporte (no de validación), lo encola en
// IndexedDB para sincronizar cuando vuelva la conexión.
export async function recordTripEvent(
  tripId: string,
  eventType: TripEventType,
  { requireGps = true }: { requireGps?: boolean } = {},
): Promise<{ queued: boolean }> {
  const recordedAt = new Date().toISOString();

  let latitude: number | null = null;
  let longitude: number | null = null;
  let accuracy: number | null = null;

  try {
    const position = await getCurrentPosition();
    latitude = position.latitude;
    longitude = position.longitude;
    accuracy = position.accuracy;
  } catch (err) {
    if (requireGps) {
      throw new TripEventError(
        "No se pudo obtener la ubicación GPS. Actívala e inténtalo de nuevo.",
      );
    }
  }

  const payload = {
    trip_id: tripId,
    event_type: eventType,
    recorded_at: recordedAt,
    latitude,
    longitude,
    gps_accuracy: accuracy,
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await queuePendingEvent({ localId: crypto.randomUUID(), ...payload });
    return { queued: true };
  }

  const supabase = createClient();
  const { error } = await supabase.from("trip_events").insert(payload);

  if (error) {
    // Sin `code`: la petición nunca llegó al servidor (falla de red/transporte).
    // Con `code`: el servidor respondió y rechazó la operación (p.ej. RLS) — es un error real.
    if (!error.code) {
      await queuePendingEvent({ localId: crypto.randomUUID(), ...payload });
      return { queued: true };
    }
    throw new TripEventError(error.message);
  }

  return { queued: false };
}
