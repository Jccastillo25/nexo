"use client";

// Terminal de marcacion — pensada para un tablet/monitor tactil montado
// en sucursal (ej. Ferreteria La Maxima, Zona Gypsum), no para un admin
// en su escritorio: pantalla completa, sin ShellBar/Sidebar (esta ruta
// vive fuera del route group (app), ver app/kiosco/page.tsx), sin texto
// chico, sin mouse asumido — solo tacto.

import { useCallback, useEffect, useRef, useState } from "react";
import { marcarAsistencia, type MarcarResult } from "./actions";

const PIN_LENGTH = 4;
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
const KEYS: Digit[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: MarcarResult }
  | { kind: "error"; message: string };

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function KioskClient({ kioskoNombre }: { kioskoNombre?: string }) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const now = useClock();

  const reset = useCallback(() => {
    setPin("");
    setStatus({ kind: "idle" });
  }, []);

  const submit = useCallback(async (value: string) => {
    setStatus({ kind: "loading" });
    try {
      const result = await marcarAsistencia(value);
      if (result.ok) {
        setStatus({ kind: "success", result });
      } else {
        setStatus({ kind: "error", message: result.message });
      }
    } catch {
      setStatus({ kind: "error", message: "Error de conexión. Intentá de nuevo." });
    }
    setPin("");
    resetTimer.current = setTimeout(reset, 3500);
  }, [reset]);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function pressDigit(d: string) {
    if (status.kind === "loading" || status.kind === "success") return;
    if (status.kind === "error") {
      // Cualquier tecla despues de un error limpia el mensaje y arranca de nuevo.
      setStatus({ kind: "idle" });
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      void submit(next);
    }
  }

  function pressBackspace() {
    if (status.kind === "loading" || status.kind === "success") return;
    setPin((p) => p.slice(0, -1));
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[var(--nexo-bg)] px-6 py-10 text-white select-none">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          {kioskoNombre ?? "Materiales J Castillo · RRHH"}
        </p>
        <p className="text-5xl font-semibold tabular-nums">
          {now.toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-sm capitalize text-white/50">
          {now.toLocaleDateString("es-NI", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <div className="nexo-glass flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl px-8 py-10">
        {status.kind === "success" ? (
          <SuccessPanel result={status.result} />
        ) : (
          <>
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium uppercase tracking-wide text-white/60">
                Ingresá tu PIN
              </p>
              <PinDots length={pin.length} error={status.kind === "error"} />
              {status.kind === "error" && (
                <p className="text-sm font-medium text-red-400">{status.message}</p>
              )}
              {status.kind === "loading" && (
                <p className="text-sm text-white/50">Verificando…</p>
              )}
            </div>

            <NumPad onDigit={pressDigit} onBackspace={pressBackspace} disabled={status.kind === "loading"} />
          </>
        )}
      </div>
    </div>
  );
}

function PinDots({ length, error }: { length: number; error: boolean }) {
  return (
    <div className="flex gap-3">
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full border transition-colors ${
            i < length
              ? error
                ? "border-red-400 bg-red-400"
                : "border-[var(--nexo-accent)] bg-[var(--nexo-accent)]"
              : "border-white/25 bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

function NumPad({
  onDigit,
  onBackspace,
  disabled,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {KEYS.map((key, i) => {
        if (key === "") return <div key={i} />;
        if (key === "⌫") {
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={onBackspace}
              aria-label="Borrar"
              className="nexo-glass flex h-20 w-20 items-center justify-center rounded-2xl text-2xl text-white/70 transition-transform active:scale-95 disabled:opacity-40"
            >
              ⌫
            </button>
          );
        }
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(key)}
            className="nexo-glass flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-semibold tabular-nums text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

function SuccessPanel({ result }: { result: MarcarResult }) {
  const isEntrada = result.tipo === "entrada";
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
          isEntrada ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
        }`}
        aria-hidden="true"
      >
        {isEntrada ? "→" : "←"}
      </span>
      <p className="text-2xl font-semibold text-white">{result.message}</p>
      {result.empleadoNombre && (
        <p className="text-lg text-white/70">{result.empleadoNombre}</p>
      )}
    </div>
  );
}
