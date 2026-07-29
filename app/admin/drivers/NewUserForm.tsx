"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewUserForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [role, setRole] = useState<"driver" | "admin">("driver");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, role, pinCode }),
    });
    const body = await res.json();

    setSubmitting(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo crear el usuario.");
      return;
    }

    setFullName("");
    setEmail("");
    setPassword("");
    setPinCode("");
    setRole("driver");
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl bg-slate-900 p-4">
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
      <input
        type="text"
        inputMode="numeric"
        placeholder="PIN de 4 dígitos (opcional)"
        maxLength={4}
        value={pinCode}
        onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ""))}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRole("driver")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${role === "driver" ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300"}`}
        >
          Conductor
        </button>
        <button
          type="button"
          onClick={() => setRole("admin")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${role === "admin" ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300"}`}
        >
          Administrador
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">Usuario creado correctamente.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-900 disabled:opacity-50"
      >
        {submitting ? "Creando..." : "Crear usuario"}
      </button>
    </form>
  );
}
