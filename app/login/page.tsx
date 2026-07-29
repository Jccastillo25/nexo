"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BigButton } from "@/components/BigButton";

const LAST_EMAIL_KEY = "transporte:last-email";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [email, setEmail] = useState(
    typeof window !== "undefined" ? window.localStorage.getItem(LAST_EMAIL_KEY) ?? "" : "",
  );
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    window.localStorage.setItem(LAST_EMAIL_KEY, email);
    // "/" y no "/driver": el proxy decide a dónde ir según el rol (admin -> /admin).
    router.push("/");
    router.refresh();
  }

  async function handlePinSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo iniciar sesión.");
        return;
      }

      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: body.email,
        token_hash: body.token_hash,
        type: "magiclink",
      });

      if (verifyError) {
        setError("No se pudo iniciar sesión.");
        return;
      }

      window.localStorage.setItem(LAST_EMAIL_KEY, email);
      router.push("/driver");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 bg-slate-900 px-6 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-3xl font-bold">Ruta360</h1>
        <p className="mb-8 text-slate-400">Ingresa para iniciar tu jornada</p>

        <div className="mb-6 flex rounded-xl bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 rounded-lg py-3 text-base font-semibold ${mode === "password" ? "bg-amber-400 text-slate-900" : "text-slate-300"}`}
          >
            Usuario/Contraseña
          </button>
          <button
            type="button"
            onClick={() => setMode("pin")}
            className={`flex-1 rounded-lg py-3 text-base font-semibold ${mode === "pin" ? "bg-amber-400 text-slate-900" : "text-slate-300"}`}
          >
            PIN
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-lg text-white placeholder:text-slate-500"
            />
            <input
              type="password"
              autoComplete="current-password"
              required
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-lg text-white placeholder:text-slate-500"
            />
            {error && <p className="text-red-400">{error}</p>}
            <BigButton type="submit" loading={loading}>
              Ingresar
            </BigButton>
          </form>
        ) : (
          <form onSubmit={handlePinSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-lg text-white placeholder:text-slate-500"
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              required
              placeholder="PIN de 4 dígitos"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-4 text-center text-3xl tracking-[0.5em] text-white placeholder:text-base placeholder:tracking-normal placeholder:text-slate-500"
            />
            {error && <p className="text-red-400">{error}</p>}
            <BigButton type="submit" loading={loading}>
              Ingresar
            </BigButton>
          </form>
        )}
      </div>
    </main>
  );
}
