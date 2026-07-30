"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";

export function PinPanel({ driverId, pin }: { driverId: string; pin: string }) {
  const router = useRouter();
  const [currentPin, setCurrentPin] = useState(pin);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setError(null);
    setRegenerating(true);

    const res = await fetch(`/api/admin/drivers/${driverId}/reset-pin`, { method: "POST" });
    const body = await res.json();

    setRegenerating(false);

    if (!res.ok) {
      setError(body.error ?? "No se pudo restablecer el PIN.");
      return;
    }

    setCurrentPin(body.pin);
    setVisible(true);
    router.refresh();
  }

  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-xl bg-slate-900 p-4">
      <div>
        <p className="text-sm text-slate-400">PIN actual</p>
        <p className="text-3xl font-bold tracking-[0.3em] text-white">
          {visible ? currentPin : "••••"}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
        >
          {visible ? "Ocultar" : "Ver PIN"}
        </button>
        <BigButton
          type="button"
          variant="neutral"
          loading={regenerating}
          onClick={handleRegenerate}
          className="w-auto px-4 py-2 text-sm"
        >
          Regenerar PIN
        </BigButton>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
