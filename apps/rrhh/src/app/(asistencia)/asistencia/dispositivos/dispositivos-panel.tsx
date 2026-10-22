"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  NexoIcon,
  PageHeader,
  StatusBadge,
  hora,
  useToast,
} from "@nexo/ui";
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

// Acciones de fila: texto de color (azul, neutro o rojo) en una celda densa.
// El kit no tiene una variante de botón de texto con color de peligro, por eso
// estas siguen locales; el resto de los botones son <Button> del kit.
const botonFila =
  "rounded-md px-2 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

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
        venceHora: hora(vence),
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
      <Button onClick={abrirRegistro} disabled={isPending}>
        Registrar dispositivo
      </Button>
    ) : null;

  // Un error de validación va junto a su campo; uno sin campo (servidor), en un Alert.
  const errorNombre = errorForm?.campo === "nombre" ? errorForm.message : undefined;
  const errorUbicacion = errorForm?.campo === "ubicacion" ? errorForm.message : undefined;
  const errorGeneral = errorForm && !errorForm.campo ? errorForm.message : null;

  const descripcionConfirmacion = porDesactivar
    ? `La terminal «${porDesactivar.nombre}» dejará de registrar marcas de inmediato. Las marcas ya registradas no cambian.`
    : undefined;

  const conAcciones = canEditar || canAsignar || canRevocar;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={titulo} description={descripcion} actions={formulario || panel ? null : botonRegistrar} />

      {formulario && (
        <form
          onSubmit={guardar}
          noValidate
          aria-labelledby="dispositivo-form-titulo"
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
        >
          <h2 id="dispositivo-form-titulo" className="text-base font-semibold text-neutral-900">
            {formulario.modo === "crear" ? "Registrar dispositivo" : `Editar «${formulario.nombre}»`}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nombre" required error={errorNombre}>
              <Input
                ref={nombreRef}
                name="nombre"
                required
                maxLength={NOMBRE_MAX}
                autoComplete="off"
                value={campos.nombre}
                onChange={(e) => setCampos((c) => ({ ...c, nombre: e.target.value }))}
                placeholder="ej. Terminal bodega central"
              />
            </Field>
            <Field label="Ubicación" optional error={errorUbicacion}>
              <Input
                name="ubicacion"
                maxLength={UBICACION_MAX}
                autoComplete="off"
                value={campos.ubicacion}
                onChange={(e) => setCampos((c) => ({ ...c, ubicacion: e.target.value }))}
                placeholder="ej. Entrada de personal"
              />
            </Field>
          </div>

          {errorGeneral ? <Alert tone="error">{errorGeneral}</Alert> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={cerrarFormulario} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              {isPending ? "Guardando…" : formulario.modo === "crear" ? "Registrar dispositivo" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      )}

      {panel && (
        <section
          aria-labelledby="codigo-terminal-titulo"
          className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
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
                <Button variant="secondary" onClick={cerrarPanel} disabled={isPending}>
                  Cerrar
                </Button>
                <Button
                  onClick={() => generarCodigo(panel.kioskoId, panel.nombre, abridorPanelRef.current)}
                  loading={isPending}
                >
                  {isPending ? "Generando…" : "Generar otro código"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-3xl font-semibold tabular-nums tracking-widest text-neutral-900 break-all">
                {agruparCodigo(panel.codigo)}
              </p>
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-neutral-700">
                <li className="break-words">
                  En el equipo del kiosco abre <span className="font-medium text-neutral-900">{panel.origen}/rrhh/kiosco</span>.
                </li>
                <li>Escribe este código.</li>
                <li>Sirve una sola vez y vence a las {panel.venceHora}.</li>
              </ol>
              <Alert tone="warning">Este código no se volverá a mostrar.</Alert>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={cerrarPanel}>
                  Cerrar
                </Button>
                <Button variant="secondary" onClick={() => router.refresh()} icon={<NexoIcon name="refresh" />}>
                  Actualizar estado
                </Button>
                <Button onClick={() => void copiarCodigo(panel.codigo)}>Copiar código</Button>
              </div>
            </>
          )}
        </section>
      )}

      {errorAccion ? <Alert tone="error">{errorAccion}</Alert> : null}

      {errorEquipos && !errorDeCarga ? (
        <Alert tone="warning">
          No se pudo consultar qué equipos están asignados. La columna «Equipo» dice «No disponible»; recarga la página
          en unos minutos.
        </Alert>
      ) : null}

      {errorDeCarga ? (
        <EmptyState
          variant="error"
          title="No se pudieron cargar los dispositivos"
          action={
            <Button variant="secondary" onClick={() => router.refresh()} icon={<NexoIcon name="refresh" />}>
              Intentar de nuevo
            </Button>
          }
        />
      ) : filas.length === 0 ? (
        <EmptyState
          title="Todavía no hay dispositivos registrados"
          description={
            canCrear
              ? "Registra la primera terminal para que el personal pueda marcar entradas y salidas."
              : "Pide a un administrador que registre la terminal."
          }
          // Una sola acción primary por pantalla: la del PageHeader. Aquí se
          // repite como secondary para no competir con ella.
          action={
            formulario || !canCrear ? undefined : (
              <Button variant="secondary" onClick={abrirRegistro} disabled={isPending}>
                Registrar dispositivo
              </Button>
            )
          }
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
                  {f.activo && (
                    // La terminal es pública y no va en el menú; desde aquí se
                    // abre en otra pestaña. next/link aplica el basePath /rrhh.
                    // Abre la terminal de este navegador, no la del dispositivo
                    // de la fila: sin equipo asignado muestra la pantalla para
                    // canjear el código.
                    <Link
                      href="/kiosco"
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
