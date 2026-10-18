"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ConfirmDialog, DataTable, EmptyState, PageHeader, StatusBadge, useToast } from "@nexo/ui";
import {
  cambiarEstadoDispositivo,
  editarDispositivo,
  generarCodigoTerminal,
  registrarDispositivo,
  revocarTerminal,
} from "./actions";
import { NOMBRE_MAX, UBICACION_MAX, validarDispositivo, type DispositivoInput } from "./validacion";

/** Estado del equipo enrolado (asistencia_estado_terminales). */
export type EstadoEquipo = "sin_asignar" | "codigo_pendiente" | "asignada";

/** Fila ya preparada en el servidor (ver page.tsx): `id` solo con permisos de acción. */
export interface DispositivoFila {
  clave: string;
  id: string | null;
  nombre: string;
  ubicacion: string | null;
  activo: boolean;
  /** Fecha de registro ya formateada (es-NI, America/Managua). */
  registrado: string;
  /** Es la terminal configurada en este despliegue (NEXO_KIOSKO_ID). */
  enUso: boolean;
  /** Estado del equipo; `null` si no se pudo consultar. */
  equipo: EstadoEquipo | null;
  /** Hora de vencimiento del código pendiente, ya formateada. */
  codigoVenceHora: string | null;
  /** Último uso del equipo asignado, ya formateado. */
  ultimoUso: string | null;
  /** Fecha de la última revocación, ya formateada. */
  revocadoEl: string | null;
}

export interface DispositivosPanelProps {
  titulo: string;
  descripcion: string;
  filas: DispositivoFila[];
  errorDeCarga: boolean;
  /** Falló asistencia_estado_terminales: la columna "Equipo" dice "No disponible". */
  errorEquipos: boolean;
  canCrear: boolean;
  canEditar: boolean;
  canAsignar: boolean;
  canRevocar: boolean;
}

type Formulario = { modo: "crear" } | { modo: "editar"; id: string; nombre: string };
type ErrorFormulario = { message: string; campo?: "nombre" | "ubicacion" };

/** Código recién generado. Vive solo en memoria del navegador: no se vuelve a mostrar. */
type PanelCodigo = {
  kioskoId: string;
  nombre: string;
  /** Vacío cuando el código venció (se descarta de la memoria). */
  codigo: string;
  venceEn: number;
  venceHora: string;
  origen: string;
  vencido: boolean;
};

const VACIO: DispositivoInput = { nombre: "", ubicacion: "" };

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 aria-[invalid=true]:border-red-400";
const botonPrimario =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const botonSecundario =
  "rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const botonFila =
  "rounded-md px-2 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

const formatoHora = new Intl.DateTimeFormat("es-NI", {
  timeZone: "America/Managua",
  hour: "2-digit",
  minute: "2-digit",
});

/** "0123456789" → "01234 56789". */
function agruparCodigo(codigo: string) {
  return `${codigo.slice(0, 5)} ${codigo.slice(5)}`;
}

/** Devuelve el foco al botón que abrió un formulario/panel, o al h1 si ya no existe. */
function devolverFoco(abridor: HTMLElement | null) {
  requestAnimationFrame(() => {
    if (abridor?.isConnected) abridor.focus();
    else {
      const titulo = document.querySelector<HTMLElement>("main h1");
      if (titulo) {
        titulo.tabIndex = -1;
        titulo.focus();
      }
    }
  });
}

function elementoActivo() {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

/**
 * Pantalla de Dispositivos de marcación (2026-10-17). Patrón de referencia:
 * contratacion/catalogos/puestos (Server Component + panel cliente +
 * Server Actions con revalidatePath). Sin eliminar: solo desactivar (con
 * confirmación) y reactivar. Desde el enrolamiento de terminales
 * (2026-10-17) también asigna, cancela y revoca el equipo de cada
 * dispositivo con un código de un solo uso.
 */
export default function DispositivosPanel({
  titulo,
  descripcion,
  filas,
  errorDeCarga,
  errorEquipos,
  canCrear,
  canEditar,
  canAsignar,
  canRevocar,
}: DispositivosPanelProps) {
  const { show } = useToast();
  const router = useRouter();
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [campos, setCampos] = useState<DispositivoInput>(VACIO);
  const [errorForm, setErrorForm] = useState<ErrorFormulario | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [porDesactivar, setPorDesactivar] = useState<DispositivoFila | null>(null);
  const [porReasignar, setPorReasignar] = useState<DispositivoFila | null>(null);
  const [porRevocar, setPorRevocar] = useState<DispositivoFila | null>(null);
  const [panel, setPanel] = useState<PanelCodigo | null>(null);
  const [isPending, startTransition] = useTransition();
  const nombreRef = useRef<HTMLInputElement>(null);
  const panelTituloRef = useRef<HTMLHeadingElement>(null);
  // Botón que abrió el formulario: recibe el foco de vuelta al cerrarlo.
  const abridorRef = useRef<HTMLElement | null>(null);
  // Ídem para el panel del código.
  const abridorPanelRef = useRef<HTMLElement | null>(null);

  // Al abrir el formulario (registrar o editar), el foco va al primer campo.
  useEffect(() => {
    if (formulario) nombreRef.current?.focus();
  }, [formulario]);

  // Al mostrar un código nuevo, el foco va al título del panel.
  const panelClave = panel && !panel.vencido ? `${panel.kioskoId}:${panel.venceEn}` : null;
  useEffect(() => {
    if (panelClave) panelTituloRef.current?.focus();
  }, [panelClave]);

  // Temporizador simple: al vencer, el código se oculta y se descarta.
  const venceEn = panel && !panel.vencido ? panel.venceEn : null;
  useEffect(() => {
    if (venceEn === null) return;
    const id = setTimeout(
      () => setPanel((p) => (p && p.venceEn === venceEn ? { ...p, codigo: "", vencido: true } : p)),
      Math.max(0, venceEn - Date.now())
    );
    return () => clearTimeout(id);
  }, [venceEn]);

  function recordarAbridor() {
    abridorRef.current = elementoActivo();
  }

  function abrirRegistro() {
    recordarAbridor();
    setErrorForm(null);
    setErrorAccion(null);
    setCampos(VACIO);
    setFormulario({ modo: "crear" });
  }

  function abrirEdicion(fila: DispositivoFila) {
    if (!fila.id) return;
    recordarAbridor();
    setErrorForm(null);
    setErrorAccion(null);
    setCampos({ nombre: fila.nombre, ubicacion: fila.ubicacion ?? "" });
    setFormulario({ modo: "editar", id: fila.id, nombre: fila.nombre });
  }

  function cerrarFormulario() {
    setFormulario(null);
    setErrorForm(null);
    setCampos(VACIO);
    // Tras desmontar el formulario: si el botón que lo abrió ya no existe
    // (la tabla se refrescó), el foco va al encabezado de la página.
    const abridor = abridorRef.current;
    abridorRef.current = null;
    devolverFoco(abridor);
  }

  function cerrarPanel() {
    setPanel(null);
    const abridor = abridorPanelRef.current;
    abridorPanelRef.current = null;
    devolverFoco(abridor);
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!formulario) return;
    const validacion = validarDispositivo(campos);
    if (!validacion.ok) {
      setErrorForm({ message: validacion.message, campo: validacion.campo });
      return;
    }
    setErrorForm(null);
    const actual = formulario;
    startTransition(async () => {
      const res =
        actual.modo === "crear"
          ? await registrarDispositivo(campos)
          : await editarDispositivo(actual.id, campos);
      if (!res.ok) {
        setErrorForm({ message: res.message, campo: res.campo });
        return;
      }
      cerrarFormulario();
      show(actual.modo === "crear" ? "Dispositivo registrado" : "Cambios guardados", "success");
    });
  }

  function cambiarEstado(fila: DispositivoFila, activo: boolean) {
    if (!fila.id) return;
    const id = fila.id;
    setErrorAccion(null);
    startTransition(async () => {
      const res = await cambiarEstadoDispositivo(id, activo);
      setPorDesactivar(null);
      if (!res.ok) {
        setErrorAccion(res.message);
        return;
      }
      show(activo ? "Dispositivo reactivado" : "Dispositivo desactivado", "success");
    });
  }

  async function copiarIdentificador(fila: DispositivoFila) {
    if (!fila.id) return;
    try {
      await navigator.clipboard.writeText(fila.id);
      show("Identificador copiado", "success");
    } catch {
      show("No se pudo copiar el identificador. Intenta de nuevo.", "error");
    }
  }

  /** Genera el código. `abridor` recibe el foco al cerrar el panel. */
  function generarCodigo(kioskoId: string, nombre: string, abridor: HTMLElement | null) {
    setErrorAccion(null);
    startTransition(async () => {
      const res = await generarCodigoTerminal(kioskoId);
      setPorReasignar(null);
      if (!res.ok) {
        setErrorAccion(res.message);
        return;
      }
      const vence = new Date(res.venceEn);
      abridorPanelRef.current = abridor;
      setPanel({
        kioskoId,
        nombre,
        codigo: res.codigo,
        venceEn: vence.getTime(),
        venceHora: formatoHora.format(vence),
        origen: window.location.origin,
        vencido: false,
      });
    });
  }

  function asignarEquipo(fila: DispositivoFila) {
    if (!fila.id) return;
    setErrorAccion(null);
    if (fila.equipo === "asignada") {
      abridorPanelRef.current = elementoActivo();
      setPorReasignar(fila);
      return;
    }
    generarCodigo(fila.id, fila.nombre, elementoActivo());
  }

  function revocar(fila: DispositivoFila, tipo: "cancelar" | "revocar") {
    if (!fila.id) return;
    const id = fila.id;
    setErrorAccion(null);
    startTransition(async () => {
      const res = await revocarTerminal(id);
      setPorRevocar(null);
      if (!res.ok) {
        setErrorAccion(res.message);
        return;
      }
      // El código que mostraba el panel ya no sirve.
      setPanel((p) => (p && p.kioskoId === id ? null : p));
      show(tipo === "cancelar" ? "Código cancelado" : "Equipo revocado", "success");
      // El botón de la fila desaparece al refrescar: el foco va al título.
      devolverFoco(null);
    });
  }

  async function copiarCodigo(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      show("Código copiado", "success");
    } catch {
      show("No se pudo copiar el código. Intenta de nuevo.", "error");
    }
  }

  const botonRegistrar =
    canCrear && !errorDeCarga ? (
      <button type="button" onClick={abrirRegistro} disabled={isPending} className={botonPrimario}>
        Registrar dispositivo
      </button>
    ) : null;

  const errorNombre = errorForm?.campo === "nombre";
  const errorUbicacion = errorForm?.campo === "ubicacion";

  const descripcionConfirmacion = porDesactivar
    ? `La terminal «${porDesactivar.nombre}» dejará de registrar marcas de inmediato. Las marcas ya registradas no cambian.${
        porDesactivar.enUso ? " La terminal del kiosco de este despliegue dejará de funcionar." : ""
      }`
    : undefined;

  const conAcciones = canEditar || canAsignar || canRevocar;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={titulo} description={descripcion} actions={formulario ? null : botonRegistrar} />

      {formulario && (
        <form
          onSubmit={guardar}
          noValidate
          aria-labelledby="dispositivo-form-titulo"
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <h2 id="dispositivo-form-titulo" className="text-base font-semibold text-neutral-900">
            {formulario.modo === "crear" ? "Registrar dispositivo" : `Editar «${formulario.nombre}»`}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-neutral-600">Nombre</span>
              <input
                ref={nombreRef}
                name="nombre"
                required
                maxLength={NOMBRE_MAX}
                autoComplete="off"
                value={campos.nombre}
                onChange={(e) => setCampos((c) => ({ ...c, nombre: e.target.value }))}
                placeholder="ej. Terminal bodega central"
                aria-invalid={errorNombre}
                aria-describedby={errorNombre ? "dispositivo-form-error" : undefined}
                className={inputClass}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="text-neutral-600">Ubicación (opcional)</span>
              <input
                name="ubicacion"
                maxLength={UBICACION_MAX}
                autoComplete="off"
                value={campos.ubicacion}
                onChange={(e) => setCampos((c) => ({ ...c, ubicacion: e.target.value }))}
                placeholder="ej. Entrada de personal"
                aria-invalid={errorUbicacion}
                aria-describedby={errorUbicacion ? "dispositivo-form-error" : undefined}
                className={inputClass}
              />
            </label>
          </div>

          {errorForm && (
            <p id="dispositivo-form-error" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorForm.message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={isPending} className={botonPrimario}>
              {isPending ? "Guardando…" : formulario.modo === "crear" ? "Registrar dispositivo" : "Guardar cambios"}
            </button>
            <button type="button" onClick={cerrarFormulario} disabled={isPending} className={botonSecundario}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {panel && (
        <section
          aria-labelledby="codigo-terminal-titulo"
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <h2
            id="codigo-terminal-titulo"
            ref={panelTituloRef}
            tabIndex={-1}
            className="text-base font-semibold text-neutral-900 outline-none"
          >
            Código para «{panel.nombre}»
          </h2>

          {panel.vencido ? (
            <>
              <p role="status" className="text-sm text-neutral-700">
                El código venció. Genera uno nuevo.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => generarCodigo(panel.kioskoId, panel.nombre, abridorPanelRef.current)}
                  disabled={isPending}
                  className={botonPrimario}
                >
                  {isPending ? "Generando…" : "Generar otro código"}
                </button>
                <button type="button" onClick={cerrarPanel} disabled={isPending} className={botonSecundario}>
                  Cerrar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-3xl font-semibold tabular-nums tracking-widest text-neutral-900 break-all">
                {agruparCodigo(panel.codigo)}
              </p>
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-neutral-700">
                <li className="break-words">
                  En el equipo del kiosco abre <span className="font-medium text-neutral-900">{panel.origen}/rrhh/kiosco?asignar=1</span>.
                </li>
                <li>Escribe este código.</li>
                <li>Sirve una sola vez y vence a las {panel.venceHora}.</li>
              </ol>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Este código no se volverá a mostrar.</p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void copiarCodigo(panel.codigo)} className={botonPrimario}>
                  Copiar código
                </button>
                <button type="button" onClick={() => router.refresh()} className={botonSecundario}>
                  Actualizar estado
                </button>
                <button type="button" onClick={cerrarPanel} className={botonSecundario}>
                  Cerrar
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {errorAccion && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorAccion}
        </p>
      )}

      {errorEquipos && !errorDeCarga && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo consultar qué equipos están asignados. Intenta de nuevo.
        </p>
      )}

      {errorDeCarga ? (
        <p role="alert" className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-700">
          No se pudieron cargar los dispositivos. Intenta de nuevo.
        </p>
      ) : filas.length === 0 ? (
        <EmptyState
          title="Todavía no hay dispositivos registrados"
          description={
            canCrear
              ? "Registra la primera terminal para que el personal pueda marcar entradas y salidas."
              : "Pide a un administrador que registre la terminal."
          }
          action={formulario ? undefined : botonRegistrar}
        />
      ) : (
        <DataTable<DispositivoFila>
          rows={filas}
          rowKey={(f) => f.clave}
          columns={[
            {
              key: "nombre",
              header: "Nombre",
              render: (f) => (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-neutral-900">{f.nombre}</span>
                  {f.enUso && <StatusBadge label="En uso por esta terminal" tone="info" />}
                  {f.activo && (
                    // La terminal es pública y no va en el menú; desde aquí se
                    // abre en otra pestaña. next/link aplica el basePath /rrhh.
                    // ?asignar=1: si este navegador no tiene equipo asignado,
                    // muestra la pantalla para canjear el código aunque exista
                    // NEXO_KIOSKO_ID. Abre la terminal de este navegador, no la
                    // del dispositivo de la fila.
                    <Link
                      href="/kiosco?asignar=1"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Abrir la terminal en una pestaña nueva"
                      className={`${botonFila} text-blue-700 hover:bg-blue-50`}
                    >
                      Abrir terminal
                    </Link>
                  )}
                </div>
              ),
            },
            { key: "ubicacion", header: "Ubicación", render: (f) => f.ubicacion || "—" },
            {
              key: "estado",
              header: "Estado",
              render: (f) => (
                <StatusBadge label={f.activo ? "Activo" : "Inactivo"} tone={f.activo ? "positive" : "neutral"} />
              ),
            },
            {
              key: "equipo",
              header: "Equipo",
              render: (f) => <CeldaEquipo fila={f} />,
            },
            {
              key: "registrado",
              header: "Registrado",
              className: "whitespace-nowrap tabular-nums",
              render: (f) => f.registrado,
            },
            ...(conAcciones
              ? [
                  {
                    key: "acciones",
                    header: "Acciones",
                    align: "right" as const,
                    render: (f: DispositivoFila) =>
                      f.id ? (
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {canAsignar && f.activo && f.equipo !== null && (
                            <button
                              type="button"
                              onClick={() => asignarEquipo(f)}
                              disabled={isPending}
                              aria-label={`Asignar equipo a ${f.nombre}`}
                              className={`${botonFila} text-blue-600 hover:bg-blue-50 hover:text-blue-700`}
                            >
                              Asignar equipo
                            </button>
                          )}
                          {canRevocar && f.equipo === "codigo_pendiente" && (
                            <button
                              type="button"
                              onClick={() => revocar(f, "cancelar")}
                              disabled={isPending}
                              aria-label={`Cancelar código de ${f.nombre}`}
                              className={`${botonFila} text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900`}
                            >
                              Cancelar código
                            </button>
                          )}
                          {canRevocar && f.equipo === "asignada" && (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorAccion(null);
                                setPorRevocar(f);
                              }}
                              disabled={isPending}
                              aria-label={`Revocar equipo de ${f.nombre}`}
                              className={`${botonFila} text-red-600 hover:bg-red-50 hover:text-red-700`}
                            >
                              Revocar equipo
                            </button>
                          )}
                          {canEditar && (
                            <>
                              <button
                                type="button"
                                onClick={() => abrirEdicion(f)}
                                disabled={isPending}
                                aria-label={`Editar ${f.nombre}`}
                                className={`${botonFila} text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900`}
                              >
                                Editar
                              </button>
                              {f.activo ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setErrorAccion(null);
                                    setPorDesactivar(f);
                                  }}
                                  disabled={isPending}
                                  aria-label={`Desactivar ${f.nombre}`}
                                  className={`${botonFila} text-red-600 hover:bg-red-50 hover:text-red-700`}
                                >
                                  Desactivar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => cambiarEstado(f, true)}
                                  disabled={isPending}
                                  aria-label={`Reactivar ${f.nombre}`}
                                  className={`${botonFila} text-blue-600 hover:bg-blue-50 hover:text-blue-700`}
                                >
                                  Reactivar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void copiarIdentificador(f)}
                                aria-label={`Copiar identificador de ${f.nombre}`}
                                className={`${botonFila} text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900`}
                              >
                                Copiar identificador
                              </button>
                            </>
                          )}
                        </div>
                      ) : null,
                  },
                ]
              : []),
          ]}
        />
      )}

      <ConfirmDialog
        open={porDesactivar !== null}
        title="Desactivar dispositivo"
        description={descripcionConfirmacion}
        confirmLabel="Desactivar"
        cancelLabel="Cancelar"
        destructive
        pending={isPending}
        onConfirm={() => {
          if (porDesactivar) cambiarEstado(porDesactivar, false);
        }}
        onCancel={() => setPorDesactivar(null)}
      />

      <ConfirmDialog
        open={porReasignar !== null}
        title="Asignar otro equipo"
        description={
          porReasignar
            ? `«${porReasignar.nombre}» ya tiene un equipo asignado. Cuando se use el código nuevo, el equipo actual dejará de registrar marcas.`
            : undefined
        }
        confirmLabel="Generar código"
        cancelLabel="Cancelar"
        pending={isPending}
        onConfirm={() => {
          if (porReasignar?.id) generarCodigo(porReasignar.id, porReasignar.nombre, abridorPanelRef.current);
        }}
        onCancel={() => {
          setPorReasignar(null);
          const abridor = abridorPanelRef.current;
          abridorPanelRef.current = null;
          devolverFoco(abridor);
        }}
      />

      <ConfirmDialog
        open={porRevocar !== null}
        title="Revocar equipo"
        description={
          porRevocar
            ? `El equipo de «${porRevocar.nombre}» dejará de registrar marcas de inmediato y mostrará «Terminal sin asignar». Las marcas ya registradas no cambian. Para volver a usarlo, genera un código nuevo.`
            : undefined
        }
        confirmLabel="Revocar equipo"
        cancelLabel="Cancelar"
        destructive
        pending={isPending}
        onConfirm={() => {
          if (porRevocar) revocar(porRevocar, "revocar");
        }}
        onCancel={() => setPorRevocar(null)}
      />
    </div>
  );
}

function CeldaEquipo({ fila }: { fila: DispositivoFila }) {
  if (fila.equipo === null) return <span className="text-sm text-neutral-500">No disponible</span>;
  const detalle =
    fila.equipo === "asignada"
      ? fila.ultimoUso
        ? `Último uso: ${fila.ultimoUso}`
        : "Sin uso todavía"
      : fila.equipo === "codigo_pendiente"
        ? fila.codigoVenceHora
          ? `Vence a las ${fila.codigoVenceHora}`
          : null
        : fila.revocadoEl
          ? `Revocado el ${fila.revocadoEl}`
          : null;
  const badge =
    fila.equipo === "asignada" ? (
      <StatusBadge label="Equipo asignado" tone="positive" />
    ) : fila.equipo === "codigo_pendiente" ? (
      <StatusBadge label="Código pendiente" tone="warning" />
    ) : (
      <StatusBadge label="Sin equipo" tone="neutral" />
    );
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      {badge}
      {detalle ? <span className="text-xs text-neutral-500 tabular-nums">{detalle}</span> : null}
    </div>
  );
}
