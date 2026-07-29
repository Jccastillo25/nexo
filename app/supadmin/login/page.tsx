"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BigButton } from "@/components/BigButton";

export default function SupadminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
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

    router.push("/supadmin");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-6 bg-black px-6 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold">Ruta360 · Super Admin</h1>
        <p className="mb-8 text-slate-500">Acceso restringido a operadores de la plataforma.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-4 text-lg text-white placeholder:text-slate-500"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-4 text-lg text-white placeholder:text-slate-500"
          />
          {error && <p className="text-red-400">{error}</p>}
          <BigButton type="submit" loading={loading}>
            Ingresar
          </BigButton>
        </form>
      </div>
    </main>
  );
}
