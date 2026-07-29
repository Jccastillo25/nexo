"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";

export function NewCompanyForm() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [ruc, setRuc] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [maxUsers, setMaxUsers] = useState("10");

  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/supadmin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        ruc,
        address,
        phone,
        companyEmail,
        maxUsers: Number(maxUsers),
        adminFullName,
        adminEmail,
        adminPassword,
      }),
    });
    const body = await res.json();

    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo crear la empresa.");
      return;
    }

    router.push(`/supadmin/companies/${body.companyId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-slate-100">Datos de la empresa</h2>
        <input
          type="text"
          placeholder="Nombre de la empresa"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        <input
          type="text"
          placeholder="RUC / identificación fiscal"
          value={ruc}
          onChange={(e) => setRuc(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        <textarea
          placeholder="Dirección fiscal"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        <div className="flex gap-3">
          <input
            type="tel"
            placeholder="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-1/2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
          <input
            type="email"
            placeholder="Correo de contacto"
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            className="w-1/2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Límite de usuarios permitidos</label>
          <input
            type="number"
            min={1}
            required
            value={maxUsers}
            onChange={(e) => setMaxUsers(e.target.value)}
            className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-slate-100">Primer administrador</h2>
        <input
          type="text"
          placeholder="Nombre completo"
          required
          value={adminFullName}
          onChange={(e) => setAdminFullName(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        <input
          type="email"
          placeholder="Correo"
          required
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
        <input
          type="password"
          placeholder="Contraseña (mínimo 8 caracteres)"
          required
          minLength={8}
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
        />
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <BigButton type="submit" loading={submitting} className="max-w-xs">
        Crear empresa
      </BigButton>
    </form>
  );
}
