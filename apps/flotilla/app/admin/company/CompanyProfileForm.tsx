"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
};

export function CompanyProfileForm({ company }: { company: Company }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(company.name);
  const [ruc, setRuc] = useState(company.ruc ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [phone, setPhone] = useState(company.phone ?? "");
  const [email, setEmail] = useState(company.email ?? "");
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

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          name: name.trim(),
          ruc: ruc.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          logo_url: logoUrl,
        })
        .eq("id", company.id);

      if (updateError) throw updateError;

      setSuccess(true);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar el perfil de la empresa.");
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
            alt="Logo de la empresa"
            className="h-20 w-20 rounded-xl object-contain bg-slate-800"
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

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Perfil guardado correctamente.</p>}

      <BigButton type="submit" loading={submitting} className="max-w-xs">
        Guardar cambios
      </BigButton>
    </form>
  );
}
