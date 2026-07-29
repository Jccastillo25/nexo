"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPlatformLogo } from "@/lib/storage";
import { BigButton } from "@/components/BigButton";
import type { PlatformSettings } from "@/lib/platform-settings";

export function PlatformSettingsForm({ settings }: { settings: PlatformSettings }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState(settings.productName);
  const [copyrightText, setCopyrightText] = useState(settings.copyrightText ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoUrl);

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
      let logoUrl = settings.logoUrl;
      if (logoFile) {
        logoUrl = await uploadPlatformLogo(logoFile);
      }

      const res = await fetch("/api/supadmin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, logoUrl, copyrightText }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar la configuración.");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("No se pudo guardar la configuración.");
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
            alt={productName}
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
        <label className="text-sm font-medium text-slate-300">
          Nombre del producto (se muestra como &quot;Ruta360&quot;)
        </label>
        <input
          type="text"
          required
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">Texto de copyright</label>
        <input
          type="text"
          placeholder="© 2026 Ruta360. Todos los derechos reservados."
          value={copyrightText}
          onChange={(e) => setCopyrightText(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Configuración guardada correctamente.</p>}

      <BigButton type="submit" loading={submitting} className="max-w-xs">
        Guardar cambios
      </BigButton>
    </form>
  );
}
