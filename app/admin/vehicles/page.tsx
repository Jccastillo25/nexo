import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewVehicleForm } from "./NewVehicleForm";

export default async function AdminVehiclesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("admins")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, license_plate, brand, model, status, current_odometer")
    .order("license_plate");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="mb-3 text-xl font-bold text-slate-100">Vehículos</h1>
        <div className="flex flex-col gap-2">
          {(vehicles ?? []).map((v) => (
            <Link
              key={v.id}
              href={`/admin/vehicles/${v.id}`}
              className="rounded-xl bg-slate-900 px-4 py-3 hover:bg-slate-800"
            >
              <p className="font-semibold text-white">{v.license_plate}</p>
              <p className="text-sm text-slate-400">
                {[v.brand, v.model].filter(Boolean).join(" ") || "—"} · {v.status} ·{" "}
                {v.current_odometer.toLocaleString()} km
              </p>
            </Link>
          ))}
          {(vehicles ?? []).length === 0 && (
            <p className="text-slate-500">Sin vehículos registrados todavía.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">Registrar vehículo</h2>
        <NewVehicleForm companyId={profile!.company_id} />
      </section>
    </div>
  );
}
