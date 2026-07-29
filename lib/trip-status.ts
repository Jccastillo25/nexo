import type { Database } from "@/lib/supabase/database.types";

type TripStatus = Database["public"]["Enums"]["trip_status"];

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  created: "Pendiente de inspección",
  inspected: "Listo para iniciar",
  in_transit: "En ruta",
  at_destination: "En destino",
  unloading: "Descargando",
  unloading_completed: "Descarga finalizada",
  completed: "Completado",
  cancelled: "Cancelado",
};
