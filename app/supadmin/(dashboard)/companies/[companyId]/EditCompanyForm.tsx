"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadCompanyLogo } from "@/lib/storage";
import { BigButton } from "@/components/BigButton";

type Company = {
  id: string;
  name: string;
  ruc: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  max_users: number | null;
  is_active: boolean;
};

export function EditCompanyForm({ company }: { company: Company }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(company.name);
  const [ruc, setRuc] = useState(company.ruc ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [phone, setPhone] = useState(company.phone ?? "");
  const [email, setEmail] = useState(company.email ?? "");
  const [maxUsers, setMaxUsers] = useState(String(company.max_users ?? ""));
  const [isActive, setIsActive] = useState(company.is_active);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logo_url);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      let logoUrl = company.logo_url;
      if (logoFile) {
        logoUrl = await uploadCompanyLogo(logoFile, company.id);
      }

      const res = await fetch(`/api/supadmin/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ruc,
          address,
          phone,
          email,
          logoUrl,
          maxUsers: Number(maxUsers),
          isActive,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar la empresa.");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("No se pudo guardar la empresa.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-4">
        {logoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo puede venir de storage externo o preview local
          <img
            src={logoPreview}
            alt={name}
            className="h-20 w-20 rounded-xl bg-slate-800 object-contain"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-800 text-xs text-slate-500">
            Sin logo
          </div>
        )}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
          >
            Cambiar logo
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Nombre de la empresa</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">RUC / identificación fiscal</label>
        <input
          type="text"
          value={ruc}
          onChange={(e) => setRuc(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Dirección fiscal</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Correo de contacto</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
      </div>

      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Límite de usuarios</label>
          <input
            type="number"
            min={1}
            required
            value={maxUsers}
            onChange={(e) => setMaxUsers(e.target.value)}
            className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>

        <label className="flex items-center gap-2 pb-2 text-slate-200">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-5 w-5"
          />
          Empresa activa
        </label>
      </div>

      {!isActive && (
        <p className="text-sm text-amber-400">
          Al desactivar, todos los usuarios de esta empresa pierden acceso inmediatamente.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Empresa guardada correctamente.</p>}

      <BigButton type="submit" loading={submitting} className="max-w-xs">
        Guardar cambios
      </BigButton>
    </form>
  );
}
