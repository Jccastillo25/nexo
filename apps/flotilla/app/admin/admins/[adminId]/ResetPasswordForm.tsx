"use client";

import { useState } from "react";
import { BigButton } from "@/components/BigButton";

export function ResetPasswordForm({ adminId }: { adminId: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const res = await fetch("/api/admin/admins/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId, password }),
    });
    const body = await res.json();

    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo restablecer la contraseña.");
      return;
    }

    setPassword("");
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3 rounded-xl bg-slate-900 p-4">
      <input
        type="password"
        placeholder="Nueva contraseña (mínimo 8 caracteres)"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Contraseña actualizada.</p>}
      <BigButton type="submit" loading={submitting} className="max-w-xs">
        Restablecer
      </BigButton>
    </form>
  );
}
