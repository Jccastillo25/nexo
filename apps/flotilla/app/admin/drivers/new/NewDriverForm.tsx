"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";

type Category = { id: string; name: string };

export function NewDriverForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ name: string; pin: string } | null>(null);

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        username,
        nationalId,
        licenseNumber,
        licenseType,
        licenseExpiry,
        categoryIds,
      }),
    });
    const body = await res.json();

    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo crear el conductor.");
      return;
    }

    setCreated({ name: `${firstName} ${lastName}`.trim(), pin: body.pin });
  }

  if (created) {
    return (
      <div className="flex max-w-xl flex-col gap-4 rounded-xl bg-slate-900 p-6">
        <p className="text-emerald-400">Conductor creado correctamente.</p>
        <div>
          <p className="text-sm text-slate-400">{created.name}</p>
          <p className="mt-1 text-sm text-slate-400">PIN de acceso</p>
          <p className="text-4xl font-bold tracking-[0.3em] text-white">{created.pin}</p>
          <p className="mt-1 text-xs text-slate-500">
            Compártelo con el conductor. Podrás verlo o cambiarlo después desde su perfil.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/drivers"
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Ir a conductores
          </Link>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
          >
            Crear otro
          </button>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="max-w-xl rounded-xl bg-slate-900 p-6 text-slate-300">
        <p>
          Todavía no tienes categorías de licencia registradas. Crea al menos una antes de dar de alta un
          conductor.
        </p>
        <Link
          href="/admin/license-categories"
          className="mt-3 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Ir a Categorías de licencia
        </Link>
      </div>
    );
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
        <label className="text-sm font-medium text-slate-300">Correo electrónico</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Usuario (para iniciar sesión con PIN)</label>
        <input
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        <p className="text-xs text-slate-500">
          El PIN de acceso se genera automáticamente al crear el conductor.
        </p>
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      <BigButton type="submit" loading={submitting} className="max-w-xs">
        Crear conductor
      </BigButton>
    </form>
  );
}
