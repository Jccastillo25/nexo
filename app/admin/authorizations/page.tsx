import { createClient } from "@/lib/supabase/server";
import { getEvidencePhotoSignedUrl } from "@/lib/storage";
import { AuthorizationCard } from "./AuthorizationCard";

export default async function AdminAuthorizationsPage() {
  const supabase = await createClient();

  const { data: trips } = await supabase
    .from("trips")
    .select(
      "id, start_odometer, created_at, vehicle:vehicles(id, license_plate), driver:drivers(full_name), trip_anomalies(id, description, photo_url, category:anomaly_categories(name))",
    )
    .eq("status", "pending_authorization")
    .order("created_at", { ascending: true });

  const items = await Promise.all(
    (trips ?? []).map(async (trip) => {
      const anomaly = trip.trip_anomalies[0] ?? null;
      const photoUrl = anomaly ? await getEvidencePhotoSignedUrl(supabase, anomaly.photo_url) : null;
      return { trip, anomaly, photoUrl };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Autorizaciones pendientes</h1>
        <p className="text-slate-400">
          Viajes bloqueados por una novedad reportada por el conductor. Mientras no autorices o
          deniegues, el conductor no puede iniciar ruta.
        </p>
      </div>

      {/* Agrupado por módulo de origen — hoy solo Inspección diaria genera
          solicitudes de autorización; futuros módulos suman su propia sección. */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">Inspección diaria</h2>
        <div className="flex flex-col gap-3">
          {items.map(({ trip, anomaly, photoUrl }) => (
            <AuthorizationCard key={trip.id} trip={trip} anomaly={anomaly} photoUrl={photoUrl} />
          ))}
          {items.length === 0 && (
            <p className="text-slate-500">Sin solicitudes pendientes de este módulo.</p>
          )}
        </div>
      </section>
    </div>
  );
}
