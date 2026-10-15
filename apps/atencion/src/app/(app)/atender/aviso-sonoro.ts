"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const CLAVE = "atencion.puesto.sonido";

/** Tres tonos ascendentes, distintos del "ding-dong" del televisor. */
function tocar(c: AudioContext) {
  [660, 880, 1100].forEach((freq, i) => {
    const t = c.currentTime + i * 0.18;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  });
}

/**
 * Aviso sonoro del puesto. Los navegadores solo dejan sonar audio después de
 * un toque del usuario en la página: el sonido se activa con un botón y se
 * recuerda en este navegador; al recargar, el primer toque en cualquier parte
 * lo vuelve a habilitar.
 */
// Preferencia guardada en este navegador. `memoria` cubre el caso sin
// localStorage (modo privado, bloqueado): vale para la pestaña actual.
let memoria = false;
const oyentes = new Set<() => void>();

function leerPreferencia(): boolean {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return valor === null ? memoria : valor === "1";
  } catch {
    return memoria;
  }
}

function guardarPreferencia(valor: boolean) {
  memoria = valor;
  try {
    window.localStorage.setItem(CLAVE, valor ? "1" : "0");
  } catch {
    // Queda en `memoria`.
  }
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

/**
 * Aviso sonoro del puesto. Los navegadores solo dejan sonar audio después de
 * un toque del usuario en la página: el sonido se activa con un botón y se
 * recuerda en este navegador; al recargar, el primer toque en cualquier parte
 * lo vuelve a habilitar.
 */
export function useAvisoSonoro() {
  const activado = useSyncExternalStore(suscribir, leerPreferencia, () => false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const ctx = useRef<AudioContext | null>(null);

  const contexto = useCallback(() => {
    if (!ctx.current) {
      const AudioCtx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current = new AudioCtx();
    }
    return ctx.current;
  }, []);

  // Con la preferencia ya guardada, el primer toque en la página habilita el audio.
  useEffect(() => {
    if (!activado || desbloqueado) return;
    const desbloquear = () => {
      void contexto()
        .resume()
        .then(() => setDesbloqueado(true));
    };
    window.addEventListener("pointerdown", desbloquear, { once: true });
    window.addEventListener("keydown", desbloquear, { once: true });
    return () => {
      window.removeEventListener("pointerdown", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
  }, [activado, desbloqueado, contexto]);

  const sonar = useCallback(() => {
    if (!activado || !ctx.current || ctx.current.state !== "running") return;
    tocar(ctx.current);
  }, [activado]);

  const alternar = useCallback(() => {
    const nuevo = !activado;
    guardarPreferencia(nuevo);
    if (nuevo) {
      const c = contexto();
      // Suena una vez al activar, para confirmar que el audio funciona.
      void c.resume().then(() => {
        setDesbloqueado(true);
        tocar(c);
      });
    }
  }, [activado, contexto]);

  return { activado, bloqueado: activado && !desbloqueado, alternar, sonar };
}
