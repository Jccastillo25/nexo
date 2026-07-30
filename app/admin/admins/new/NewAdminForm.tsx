"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";

export function NewAdminForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });
    const body = await res.json();

    if (!res.ok) {
      setSubmitting(false);
      setError(body.error ?? "No se pudo crear el administrador.");
      return;
    }

    router.push("/admin/admins");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3 rounded-xl bg-slate-900 p-4">
      <input
        type="text"
        placeholder="Nombre completo"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
      <input
        type="email"
        placeholder="Correo"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
      <input
        type="password"
        placeholder="Contraseña (mínimo 8 caracteres)"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <BigButton type="submit" loading={submitting} className="max-w-xs">
        Crear administrador
      </BigButton>
    </form>
  );
}
