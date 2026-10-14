"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { PantallaEstado } from "@/lib/supabase/database.types";

const INTERVALO_MS = 3000;
const DESTACADO_MS = 8000;
const VOLUMEN_NORMAL = 60;
const VOLUMEN_ANUNCIO = 10;

/** Lista o video de YouTube → URL de embed con la API de iframe habilitada. */
function embedYoutube(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const lista = u.searchParams.get("list");
    const comunes = "autoplay=1&mute=1&loop=1&controls=0&rel=0&enablejsapi=1";
    if (lista) return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(lista)}&${comunes}`;
    const video = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
    if (video) return `https://www.youtube.com/embed/${encodeURIComponent(video)}?playlist=${encodeURIComponent(video)}&${comunes}`;
  } catch {
    return null;
  }
  return null;
}

function anunciar(numero: number, puesto: string, conSonido: boolean) {
  if (!conSonido || typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.32);
    });
  } catch {
    // Sin audio disponible: el anuncio visual alcanza.
  }
  if ("speechSynthesis" in window) {
    const voz = new SpeechSynthesisUtterance(`Turno ${numero}, ${puesto}`);
    voz.lang = "es-ES";
    voz.rate = 0.9;
    window.setTimeout(() => window.speechSynthesis.speak(voz), 800);
  }
}

/**
 * Televisor de la sala: 30 % turnos (llamados y próximos), 70 %
 * entretenimiento. Cada llamado nuevo (o repetido) suena, se anuncia por voz,
 * se destaca y baja el volumen del video mientras tanto. Tema oscuro a
 * propósito: pantalla inmersiva, mismo criterio que el kiosco de RRHH.
 */
export default function PantallaPublica({ pantallaId }: { pantallaId: string }) {
  const supabase = useMemo(
    () =>
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    []
  );
  const [estado, setEstado] = useState<PantallaEstado | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [destacado, setDestacado] = useState<string | null>(null);
  const [sonido, setSonido] = useState(false);
  const vistos = useRef<Set<string> | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null);

  const video = embedYoutube(estado?.config.youtube);

  function volumen(nivel: number) {
    iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [nivel] }), "*");
  }

  useEffect(() => {
    let activo = true;
    async function cargar() {
      const { data, error } = await supabase.rpc("atencion_pantalla_estado", { p_pantalla_id: pantallaId });
      if (!activo) return;
      if (error || !data) {
        setSinAcceso(true);
        return;
      }
      setSinAcceso(false);
      const nuevo = data as PantallaEstado;
      const claves = new Set(nuevo.llamados.map((l) => `${l.numero}|${l.llamado_en}`));
      if (vistos.current) {
        const reciente = nuevo.llamados.find((l) => !vistos.current!.has(`${l.numero}|${l.llamado_en}`));
        if (reciente) {
          setDestacado(`${reciente.numero}|${reciente.llamado_en}`);
          volumen(VOLUMEN_ANUNCIO);
          anunciar(reciente.numero, reciente.puesto, sonido);
          window.setTimeout(() => {
            setDestacado(null);
            volumen(VOLUMEN_NORMAL);
          }, DESTACADO_MS);
        }
      }
      vistos.current = claves;
      setEstado(nuevo);
    }
    cargar();
    const id = window.setInterval(cargar, INTERVALO_MS);
    return () => {
      activo = false;
      window.clearInterval(id);
    };
  }, [supabase, pantallaId, sonido]);

  function activarSonido() {
    setSonido(true);
    iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
    volumen(VOLUMEN_NORMAL);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  if (sinAcceso && !estado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-center text-neutral-300">
        <p className="max-w-md text-lg">
          Esta pantalla no está disponible. Revisá que esté activa en Atención → Configuración y que el módulo esté habilitado.
        </p>
      </div>
    );
  }

  const principal = estado?.llamados[0] ?? null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-white">
      <aside className="flex w-[30%] min-w-[280px] flex-col gap-6 border-r border-neutral-800 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">{estado?.sucursal ?? ""}</p>

        <div>
          <p className="text-sm uppercase tracking-widest text-neutral-400">Turno</p>
          {principal ? (
            <div
              className={`mt-2 rounded-2xl p-6 transition-colors ${
                destacado === `${principal.numero}|${principal.llamado_en}` ? "animate-pulse bg-blue-600" : "bg-neutral-900"
              }`}
            >
              <p className="text-8xl font-bold tabular-nums leading-none">{principal.numero}</p>
              <p className="mt-3 text-3xl font-semibold text-blue-200">{principal.puesto}</p>
            </div>
          ) : (
            <p className="mt-2 text-2xl text-neutral-500">Esperando el próximo llamado</p>
          )}
        </div>

        {estado && estado.llamados.length > 1 && (
          <div className="flex flex-col gap-2">
            {estado.llamados.slice(1).map((l) => (
              <div
                key={`${l.numero}|${l.puesto}`}
                className={`flex items-center justify-between rounded-xl px-5 py-3 ${
                  destacado === `${l.numero}|${l.llamado_en}` ? "animate-pulse bg-blue-600" : "bg-neutral-900"
                }`}
              >
                <span className="text-4xl font-bold tabular-nums">{l.numero}</span>
                <span className="text-xl text-blue-200">{l.puesto}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto">
          <p className="text-sm uppercase tracking-widest text-neutral-400">Próximos</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {(estado?.proximos ?? []).length === 0 ? (
              <span className="text-xl text-neutral-600">—</span>
            ) : (
              estado!.proximos.map((n) => (
                <span key={n} className="rounded-lg bg-neutral-900 px-4 py-2 text-3xl font-semibold tabular-nums text-neutral-200">
                  {n}
                </span>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 items-center justify-center bg-black">
        {video ? (
          <iframe
            ref={iframe}
            src={video}
            title="Entretenimiento"
            allow="autoplay; encrypted-media"
            className="h-full w-full border-0"
          />
        ) : (
          <p className="text-2xl text-neutral-700">Bienvenido</p>
        )}
        {!sonido && (
          <button
            type="button"
            onClick={activarSonido}
            className="absolute bottom-6 right-6 rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            Activar sonido y pantalla completa
          </button>
        )}
      </main>
    </div>
  );
}
