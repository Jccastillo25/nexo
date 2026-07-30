"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BigButton } from "@/components/BigButton";

type Category = { id: string; name: string };

type Driver = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  national_id: string;
  license_number: string | null;
  license_type: string | null;
  license_expiry: string;
  is_active: boolean;
};

export function EditDriverForm({
  driver,
  categories,
  initiallyAssignedIds,
}: {
  driver: Driver;
  categories: Category[];
  initiallyAssignedIds: string[];
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(driver.first_name);
  const [lastName, setLastName] = useState(driver.last_name);
  const [username, setUsername] = useState(driver.username);
  const [nationalId, setNationalId] = useState(driver.national_id);
  const [licenseNumber, setLicenseNumber] = useState(driver.license_number ?? "");
  const [licenseType, setLicenseType] = useState(driver.license_type ?? "");
  const [licenseExpiry, setLicenseExpiry] = useState(driver.license_expiry);
  const [isActive, setIsActive] = useState(driver.is_active);
  const [categoryIds, setCategoryIds] = useState<string[]>(initiallyAssignedIds);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (categoryIds.length === 0) {
      setError("Selecciona al menos una categoría de licencia.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("drivers")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        username: username.trim().toLowerCase(),
        national_id: nationalId.trim(),
        license_number: licenseNumber.trim() || null,
        license_type: licenseType.trim() || null,
        license_expiry: licenseExpiry,
        is_active: isActive,
      })
      .eq("id", driver.id);

    if (updateError) {
      setSaving(false);
      setError(
        updateError.code === "23505" ? "Ese usuario ya está en uso." : "No se pudo guardar los cambios.",
      );
      return;
    }

    await supabase.from("driver_license_categories").delete().eq("driver_id", driver.id);
    const { error: categoriesError } = await supabase
      .from("driver_license_categories")
      .insert(categoryIds.map((categoryId) => ({ driver_id: driver.id, category_id: categoryId })));

    setSaving(false);

    if (categoriesError) {
      setError("Se guardó el perfil, pero no se pudieron actualizar las categorías.");
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Nombres</label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Apellidos</label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Usuario (login por PIN)</label>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">No. de identificación</label>
        <input
          type="text"
          required
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Número de licencia</label>
          <input
            type="text"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Tipo de licencia</label>
          <input
            type="text"
            value={licenseType}
            onChange={(e) => setLicenseType(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Categorías de licencia</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCategory(c.id)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                categoryIds.includes(c.id) ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300"
              }`}
            >
              {c.name}
            </button>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-slate-500">No hay categorías registradas todavía.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Fecha de vencimiento de licencia</label>
        <input
          type="date"
          required
          value={licenseExpiry}
          onChange={(e) => setLicenseExpiry(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Estado</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsActive(true)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300"}`}
          >
            Activo
          </button>
          <button
            type="button"
            onClick={() => setIsActive(false)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${!isActive ? "bg-red-900 text-red-200" : "bg-slate-800 text-slate-300"}`}
          >
            Inactivo
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Cambios guardados correctamente.</p>}

      <BigButton type="submit" loading={saving} className="max-w-xs">
        Guardar cambios
      </BigButton>
    </form>
  );
}
