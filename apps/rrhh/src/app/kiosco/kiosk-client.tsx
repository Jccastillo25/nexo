"use client";

// Terminal de marcacion — pensada para un tablet/monitor tactil montado
// en sucursal (ej. Ferreteria La Maxima, Zona Gypsum), no para un admin
// en su escritorio: pantalla completa, sin ShellBar/Sidebar (esta ruta
// vive fuera del route group (app), ver app/kiosco/page.tsx), sin texto
// chico, sin mouse asumido — solo tacto.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { canjearCodigo, marcarAsistencia, type MarcarResult } from "./actions";
import { BOTON_ACCION, type Accion } from "./acciones";
import { KioskFlow } from "./kiosk-flow";

/** Lo que decide page.tsx (el token nunca llega aquí). */
export type ModoKiosco = "pin" | "asignar" | "no_disponible";

const PIN_LENGTH = 4;
const CODIGO_LENGTH = 10;
// Foco visible y animación de pulsación que respeta prefers-reduced-motion.
const TECLA_A11Y =
  "outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100";
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
// La grilla del NumPad intercala dos teclas que no son digitos: el hueco
// vacio (celda muerta para alinear el "0" al centro) y el backspace. Digit
// solo no las admite -> KeypadKey es la union real de lo que vive en KEYS.
type KeypadKey = Digit | "" | "⌫";
const KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

// Sin elegir un botón, la vista previa se cancela y se borra el PIN.
const ESPERA_ACCION_MS = 20_000;
const ESPERA_RESULTADO_MS = 3500;

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "acciones"; acciones: Accion[] }
  | { kind: "retry"; message: string }
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

/**
 * Dígito de una tecla física: la fila de números o el teclado numérico,
 * también con Bloq Num apagado (ahí `key` es "End", "ArrowDown"…, pero
 * `code` sigue siendo "Numpad1"…).
 */
function digitoDeTecla(e: KeyboardEvent): string | null {
  if (/^[0-9]$/.test(e.key)) return e.key;
  const numpad = /^Numpad([0-9])$/.exec(e.code);
  return numpad ? numpad[1] : null;
}

export default function KioskClient({ modo, kioskoNombre }: { modo: ModoKiosco; kioskoNombre?: string }) {
  // Pantalla de asignación abierta en esta sesión de la página. Se fija en
  // el cliente porque al canjear o borrar la cookie la Server Action vuelve
  // a renderizar la página con otro `modo`: así el mensaje de éxito dura sus
  // 2 s, y un token revocado no vuelve al modo heredado de la env.
  const [asignacion, setAsignacion] = useState<{ aviso?: string } | null>(() => (modo === "asignar" ? {} : null));
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montado = useRef(true);
  const now = useClock();
  const flow = useRef<KioskFlow | null>(null);
  if (flow.current === null) {
    flow.current = new KioskFlow(marcarAsistencia);
  }

  const clearTimer = useCallback(() => {
    if (resetTimer.current) { clearTimeout(resetTimer.current); resetTimer.current = null; }
  }, []);

  // Cancelar, Escape/Backspace con los botones, los 20 s y el fin del mensaje
  // de resultado: no envía nada y borra el PIN de la memoria del flujo.
  const reset = useCallback(() => {
    clearTimer();
    flow.current?.cancel();
    setPin("");
    setStatus({ kind: "idle" });
  }, [clearTimer]);

  const send = useCallback(async (operation: () => Promise<MarcarResult>) => {
    clearTimer();
    setPin("");
    setStatus({ kind: "loading" });
    const result = await operation();
    // Si la pantalla se desmontó mientras esperaba, no se programa nada más.
    if (!montado.current) return;
    if (result.estado === "terminal_no_autorizada") {
      // El servidor ya borró la cookie: se descarta el envío y se pide un código nuevo.
      flow.current?.clear();
      setStatus({ kind: "idle" });
      setAsignacion({ aviso: result.message });
    } else if (result.estado === "acciones" && result.acciones && result.acciones.length > 0) {
      setStatus({ kind: "acciones", acciones: result.acciones });
      resetTimer.current = setTimeout(reset, ESPERA_ACCION_MS);
    } else if (result.estado === "error") {
      setStatus({ kind: "retry", message: result.message });
      // Sin elección en 20 s se cancela: la siguiente persona no puede
      // reintentar con el PIN de la anterior (revisión 2026-10-17, #3).
      resetTimer.current = setTimeout(reset, ESPERA_ACCION_MS);
    } else {
      // `registrada` (también la respuesta guardada de un reintento) o
      // `rechazada`: resultado definitivo, se descartan PIN y UUID.
      flow.current?.clear();
      setStatus(result.estado === "registrada" ? { kind: "success", result } : { kind: "error", message: result.message });
      resetTimer.current = setTimeout(reset, ESPERA_RESULTADO_MS);
    }
  }, [clearTimer, reset]);

  const submit = useCallback((value: string) => {
    if (flow.current!.busy || flow.current!.hasPending) return;
    void send(() => flow.current!.submit(value));
  }, [send]);

  const choose = useCallback((accion: Accion) => {
    // El flujo comparte la llamada en vuelo; este freno evita además procesar
    // dos veces la misma respuesta ante una doble pulsación.
    if (flow.current!.busy || status.kind !== "acciones" || !status.acciones.includes(accion)) return;
    void send(() => flow.current!.choose(accion));
  }, [send, status]);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      flow.current?.clear();
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function pressDigit(d: string) {
    if (status.kind === "loading" || status.kind === "success" || status.kind === "acciones" || status.kind === "retry") return;
    clearTimer();
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
    if (status.kind === "loading" || status.kind === "success" || status.kind === "acciones" || status.kind === "retry") return;
    setPin((p) => p.slice(0, -1));
  }

  const pantalla: ModoKiosco =
    asignacion !== null || modo === "asignar" ? "asignar" : modo === "no_disponible" ? "no_disponible" : "pin";

  // Teclado físico (fila de números o teclado numérico) en la pantalla del PIN.
  // Usa las mismas funciones que el NumPad táctil, así que respeta sus bloqueos.
  // Con los botones a la vista, 1…n elige y Escape/Backspace cancela; Enter no
  // se atiende aquí (el foco está en el título, así que no registra nada).
  useEffect(() => {
    if (pantalla !== "pin") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const digito = digitoDeTecla(e);
      if (status.kind === "acciones") {
        // Una tecla sostenida (p. ej. el último dígito del PIN) no elige un botón.
        if (e.repeat) return;
        if (digito !== null) {
          e.preventDefault();
          const accion = status.acciones[Number(digito) - 1];
          if (accion) choose(accion);
        } else if (e.key === "Escape" || e.key === "Backspace") {
          e.preventDefault();
          reset();
        }
        return;
      }
      if (digito !== null) {
        e.preventDefault();
        pressDigit(digito);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        pressBackspace();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[var(--nexo-bg)] px-6 py-10 text-white select-none">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">
          {pantalla !== "asignar" && kioskoNombre ? kioskoNombre : "Materiales J Castillo · RRHH"}
        </p>
        <p className="text-5xl font-semibold tabular-nums">
          {now.toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit", timeZone: "America/Managua" })}
        </p>
        <p className="text-sm capitalize text-white/60">
          {now.toLocaleDateString("es-NI", {
            timeZone: "America/Managua",
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {pantalla === "asignar" ? (
        <AsignarTerminal aviso={asignacion?.aviso} onAsignada={() => setAsignacion(null)} />
      ) : pantalla === "no_disponible" ? (
        <div className="nexo-glass flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl px-8 py-10 text-center">
          <h1 className="text-2xl font-semibold text-white">Esta terminal está desactivada.</h1>
          <p className="text-base text-white/70">Avisa a tu supervisor.</p>
        </div>
      ) : (
      <div className="nexo-glass flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl px-8 py-10">
        {status.kind === "success" ? (
          <SuccessPanel result={status.result} />
        ) : status.kind === "acciones" ? (
          <AccionesPanel acciones={status.acciones} onChoose={choose} onCancel={reset} />
        ) : status.kind === "retry" ? (
          <div className="flex flex-col gap-4 text-center" role="alert">
            <p>{status.message}</p>
            <button type="button" className="nexo-glass rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-white/80" onClick={() => void send(() => flow.current!.retry())}>Reintentar</button>
            <button type="button" className="nexo-glass rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-white/80" onClick={reset}>Cancelar</button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium uppercase tracking-wide text-white/60">
                Ingresá tu PIN
              </p>
              <PinDots length={pin.length} error={status.kind === "error"} />
              {status.kind === "error" && (
                <p role="alert" className="text-center text-sm font-medium text-red-400">{status.message}</p>
              )}
              {status.kind === "loading" && (
                <p className="text-sm text-white/60">Verificando…</p>
              )}
            </div>

            <NumPad onDigit={pressDigit} onBackspace={pressBackspace} disabled={status.kind === "loading"} />
          </>
        )}
      </div>
      )}
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
              className={`nexo-glass flex h-20 w-20 items-center justify-center rounded-2xl text-2xl text-white/70 disabled:opacity-40 ${TECLA_A11Y}`}
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
            className={`nexo-glass flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-semibold tabular-nums text-white disabled:opacity-40 ${TECLA_A11Y}`}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

type EstadoCanje =
  | { kind: "idle" }
  | { kind: "enviando" }
  | { kind: "rechazado" }
  | { kind: "limitado" }
  | { kind: "error" }
  | { kind: "exito"; nombre: string };

const MENSAJE_CANJE: Record<"rechazado" | "limitado" | "error", string> = {
  rechazado: "El código no es válido o ya venció. Pide uno nuevo al administrador.",
  limitado: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  error: "No se pudo conectar. Revisa la conexión e intenta de nuevo.",
};

/**
 * Pantalla "Terminal sin asignar" (enrolamiento, 2026-10-17): canjea el
 * código de 10 dígitos que genera un administrador en Asistencia →
 * Configuración → Dispositivos. El token queda en la cookie httpOnly; aquí
 * solo llegan el estado y el nombre del dispositivo.
 */
function AsignarTerminal({ aviso, onAsignada }: { aviso?: string; onAsignada: () => void }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<EstadoCanje>({ kind: "idle" });
  const listoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enVuelo = useRef(false);
  const bloqueado = estado.kind === "enviando" || estado.kind === "exito";

  useEffect(() => {
    return () => {
      if (listoTimer.current) clearTimeout(listoTimer.current);
    };
  }, []);

  const limpiarMensaje = useCallback(() => {
    setEstado((e) => (e.kind === "rechazado" || e.kind === "limitado" || e.kind === "error" ? { kind: "idle" } : e));
  }, []);

  const agregar = useCallback(
    (d: string) => {
      if (bloqueado) return;
      limpiarMensaje();
      setCodigo((c) => (c.length >= CODIGO_LENGTH ? c : c + d));
    },
    [bloqueado, limpiarMensaje]
  );

  const quitar = useCallback(() => {
    if (bloqueado) return;
    limpiarMensaje();
    setCodigo((c) => c.slice(0, -1));
  }, [bloqueado, limpiarMensaje]);

  const borrarTodo = useCallback(() => {
    if (bloqueado) return;
    limpiarMensaje();
    setCodigo("");
  }, [bloqueado, limpiarMensaje]);

  const enviar = useCallback(async () => {
    // El ref frena una doble pulsación antes de que se vuelva a renderizar.
    if (bloqueado || enVuelo.current || codigo.length !== CODIGO_LENGTH) return;
    enVuelo.current = true;
    setEstado({ kind: "enviando" });
    let res: Awaited<ReturnType<typeof canjearCodigo>>;
    try {
      res = await canjearCodigo(codigo);
    } catch {
      setEstado({ kind: "error" });
      return;
    } finally {
      enVuelo.current = false;
    }
    if (res.estado === "asignada") {
      setCodigo("");
      setEstado({ kind: "exito", nombre: res.nombre ?? "" });
      listoTimer.current = setTimeout(() => {
        router.refresh();
        onAsignada();
      }, 2000);
      return;
    }
    if (res.estado === "rechazado") setCodigo("");
    setEstado({ kind: res.estado });
  }, [bloqueado, codigo, onAsignada, router]);

  // Teclado físico: dígitos, retroceso y Enter.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Enter/Espacio sobre un botón enfocado lo activa el propio botón.
      const enBoton = e.target instanceof HTMLElement && e.target.closest("button") !== null;
      const digito = digitoDeTecla(e);
      if (digito !== null) {
        e.preventDefault();
        agregar(digito);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        quitar();
      } else if (e.key === "Enter" && !enBoton) {
        e.preventDefault();
        void enviar();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [agregar, quitar, enviar]);

  const mensajeError =
    estado.kind === "rechazado" || estado.kind === "limitado" || estado.kind === "error" ? MENSAJE_CANJE[estado.kind] : null;

  return (
    <div className="nexo-glass flex w-full max-w-md flex-col items-center gap-6 rounded-3xl px-4 py-8 text-center sm:px-8 sm:py-10">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold text-white">Terminal sin asignar</h1>
        <p className="text-sm text-white/70">
          Para usar este equipo como kiosco, pide a un administrador un código de asignación en Asistencia →
          Configuración → Dispositivos.
        </p>
        {aviso && estado.kind !== "exito" ? (
          <p role="alert" className="text-sm font-medium text-amber-300">
            {aviso}
          </p>
        ) : null}
      </div>

      {estado.kind === "exito" ? (
        <p role="status" className="py-6 text-xl font-semibold text-emerald-400">
          Terminal asignada a «{estado.nombre}»
        </p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            <p id="codigo-asignacion-etiqueta" className="text-sm font-medium uppercase tracking-wide text-white/60">
              Código de asignación
            </p>
            <div
              role="group"
              aria-labelledby="codigo-asignacion-etiqueta"
              aria-describedby="codigo-asignacion-progreso"
              className="flex items-center gap-2 sm:gap-3"
            >
              {[0, 5].map((inicio) => (
                <div key={inicio} className="flex gap-0.5 sm:gap-1">
                  {Array.from({ length: 5 }).map((_, j) => {
                    const i = inicio + j;
                    const digito = codigo[i];
                    return (
                      <span
                        key={i}
                        className={`flex h-12 w-6 items-center justify-center rounded-md border text-xl font-semibold tabular-nums sm:w-8 sm:text-2xl ${
                          digito
                            ? "border-[var(--nexo-accent)] text-white"
                            : estado.kind === "rechazado"
                              ? "border-red-400"
                              : "border-white/25"
                        }`}
                      >
                        {digito ?? ""}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            <p id="codigo-asignacion-progreso" className="sr-only">
              {codigo.length} de {CODIGO_LENGTH} dígitos
            </p>
            {estado.kind === "enviando" ? (
              <p role="status" className="text-sm text-white/70">
                Verificando código…
              </p>
            ) : null}
            {mensajeError ? (
              <p role="alert" className="text-sm font-medium text-red-400">
                {mensajeError}
              </p>
            ) : null}
          </div>

          <NumPad onDigit={agregar} onBackspace={quitar} disabled={estado.kind === "enviando"} />

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={codigo.length !== CODIGO_LENGTH || estado.kind === "enviando"}
              className="flex-1 rounded-xl bg-[var(--nexo-accent)] p-4 text-lg font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Asignar terminal
            </button>
            <button
              type="button"
              onClick={borrarTodo}
              disabled={estado.kind === "enviando" || codigo.length === 0}
              aria-label="Borrar todo el código"
              className="nexo-glass rounded-xl p-4 text-lg font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-40 sm:w-32"
            >
              Borrar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const BOTON_ACCION_BASE =
  "flex min-h-16 w-full items-center justify-center rounded-2xl px-4 py-3 text-xl font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-transform active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * Botones con las marcas válidas después del PIN (P4c). El botón es la
 * confirmación. Ningún botón recibe el foco: va al título, así un Enter suelto
 * no registra nada. Las teclas 1…n las atiende el teclado global de KioskClient.
 */
function AccionesPanel({
  acciones,
  onChoose,
  onCancel,
}: {
  acciones: Accion[];
  onChoose: (accion: Accion) => void;
  onCancel: () => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  return (
    <div role="group" aria-labelledby="kiosco-acciones-titulo" className="flex w-full flex-col gap-3">
      <h2
        id="kiosco-acciones-titulo"
        ref={titulo}
        tabIndex={-1}
        className="mb-2 text-center text-2xl font-semibold text-white outline-none"
      >
        ¿Qué quieres registrar?
      </h2>
      {acciones.map((accion, i) => {
        // Con dos opciones, "Registrar salida" queda al final y separada.
        const separada = accion === "salida" && acciones.length > 1;
        return (
          <button
            key={accion}
            type="button"
            aria-keyshortcuts={String(i + 1)}
            onClick={() => onChoose(accion)}
            className={`${BOTON_ACCION_BASE} ${i === 0 ? "bg-[var(--nexo-accent)]" : "nexo-glass"} ${
              separada ? "mt-4" : ""
            }`}
          >
            {i + 1} · {BOTON_ACCION[accion]}
          </button>
        );
      })}
      <p className="mt-2 text-center text-sm text-white/60">Se cancela en 20 s si no eliges</p>
      <button
        type="button"
        onClick={onCancel}
        aria-keyshortcuts="Escape"
        className="nexo-glass rounded-xl p-4 text-lg font-medium text-white/80 outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        Cancelar
      </button>
    </div>
  );
}

const ICONO_RESULTADO: Record<Accion, { simbolo: string; clase: string }> = {
  entrada: { simbolo: "→", clase: "bg-emerald-500/20 text-emerald-400" },
  inicio_descanso: { simbolo: "‖", clase: "bg-sky-500/20 text-sky-300" },
  fin_descanso: { simbolo: "↩", clase: "bg-sky-500/20 text-sky-300" },
  salida: { simbolo: "←", clase: "bg-amber-500/20 text-amber-400" },
};

/** Hora del servidor en HH:MM, Nicaragua. */
function horaMarca(iso: string | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleTimeString("es-NI", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Managua",
  });
}

function SuccessPanel({ result }: { result: MarcarResult }) {
  const icono = ICONO_RESULTADO[result.tipo ?? "entrada"];
  const hora = horaMarca(result.marcadoEn);
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${icono.clase}`}
        aria-hidden="true"
      >
        {icono.simbolo}
      </span>
      <p className="text-2xl font-semibold text-white">
        {result.message}
        {hora ? <span className="tabular-nums"> · {hora}</span> : null}
      </p>
      {/* A proposito: sin nombre del empleado. El kiosko es un
          dispositivo sin sesion — el feedback nunca revela la identidad
          de quien marco (2026-09-05, regla obligatoria del kiosko
          anonimo). Ver rrhh.fn_registrar_marca_kiosko. */}
    </div>
  );
}
