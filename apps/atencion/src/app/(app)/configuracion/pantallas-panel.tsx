"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, DataTable, Field, FormSection, Input, StatusBadge, useToast } from "@nexo/ui";
import { campoActivo, type CampoPantalla, type CamposPantalla, type Pantalla } from "@/lib/supabase/database.types";
import { guardarPantalla } from "./actions";

interface Borrador {
  pantallaId: string | null;
  nombre: string;
  activa: boolean;
  youtube: string;
  mostrar: Record<CampoPantalla, boolean>;
  anunciar: Record<CampoPantalla, boolean>;
}

const CAMPOS: { campo: CampoPantalla; etiqueta: string; ejemplo: string }[] = [
  { campo: "cliente", etiqueta: "Nombre del cliente", ejemplo: "Juan Pérez" },
  { campo: "factura", etiqueta: "Número de factura", ejemplo: "factura 001-1234" },
  { campo: "agente", etiqueta: "Quién lo atiende", ejemplo: "será atendido por María López" },
  { campo: "puesto", etiqueta: "Puesto", ejemplo: "Puesto 2" },
];

/** Config guardada → casillas (sin clave: marcada, salvo factura; ver campoActivo). */
function casillas(campos: CamposPantalla | undefined): Record<CampoPantalla, boolean> {
  return {
    cliente: campoActivo(campos, "cliente"),
    factura: campoActivo(campos, "factura"),
    agente: campoActivo(campos, "agente"),
    puesto: campoActivo(campos, "puesto"),
  };
}

/** Datos del cliente que esta configuración expone por el enlace público. */
function expuestos({ mostrar, anunciar }: Borrador): string[] {
  return [
    (mostrar.cliente || anunciar.cliente) && "el nombre del cliente",
    (mostrar.factura || anunciar.factura) && "el número de factura",
  ].filter((x): x is string => Boolean(x));
}

/** Lo que el televisor diría con estas casillas, para que se vea antes de guardar. */
function ejemploAnuncio(anunciar: Record<CampoPantalla, boolean>): string {
  const partes = ["Turno 5"];
  if (anunciar.cliente) partes.push("Juan Pérez");
  if (anunciar.factura) partes.push("factura 001-1234");
  if (anunciar.agente) partes.push(anunciar.puesto ? "será atendido por María López en Puesto 2" : "será atendido por María López");
  else if (anunciar.puesto) partes.push("pase a Puesto 2");
  return `“${partes.join(", ")}”`;
}

/**
 * Pantallas públicas (televisor de la sala). Cada una tiene su enlace propio,
 * que se abre en el navegador del televisor sin iniciar sesión.
 */
export default function PantallasPanel({
  sucursalId,
  pantallas,
  errorCarga = false,
}: {
  sucursalId: string;
  pantallas: Pantalla[];
  errorCarga?: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function enlace(id: string) {
    return `${window.location.origin}/atencion/pantalla/${id}`;
  }

  async function copiarEnlace(id: string) {
    try {
      await navigator.clipboard.writeText(enlace(id));
      show("Enlace copiado.", "success");
    } catch {
      show("No se pudo copiar el enlace. Ábrelo y cópialo desde la barra de direcciones.", "error");
    }
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!borrador) return;
    startTransition(async () => {
      const res = await guardarPantalla({ ...borrador, sucursalId });
      if (!res.ok) {
        setError(res.message ?? "No se pudo guardar la pantalla.");
        return;
      }
      show("Pantalla guardada.", "success");
      setBorrador(null);
      router.refresh();
    });
  }

  const exponen = borrador ? expuestos(borrador) : [];

  return (
    <FormSection
      title="Pantallas públicas"
      description="Muestran el turno llamado y los próximos números. En cada pantalla eliges qué datos del turno se ven y cuáles se anuncian por voz. Abre el enlace en el televisor."
    >
      {errorCarga ? (
        <Alert tone="error">No se pudieron cargar las pantallas. Recarga la página para intentarlo de nuevo.</Alert>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {pantallas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className="font-medium text-neutral-900">{p.nombre}</span>
                {!p.activa && <StatusBadge label="Inactiva" tone="neutral" />}
                {p.config.youtube && <StatusBadge label="Con entretenimiento" tone="info" />}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Copiar el enlace de ${p.nombre}`}
                  onClick={() => void copiarEnlace(p.id)}
                >
                  Copiar enlace
                </Button>
                <Link
                  href={`/pantalla/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir ${p.nombre} en una pestaña nueva`}
                  className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Abrir
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar ${p.nombre}`}
                  onClick={() => {
                    setBorrador({
                      pantallaId: p.id,
                      nombre: p.nombre,
                      activa: p.activa,
                      youtube: p.config.youtube ?? "",
                      mostrar: casillas(p.config.mostrar),
                      anunciar: casillas(p.config.anunciar),
                    });
                    setError(null);
                  }}
                >
                  Editar
                </Button>
              </div>
            </li>
          ))}
          {pantallas.length === 0 && <li className="px-4 py-4 text-sm text-neutral-500">Todavía no hay pantallas.</li>}
        </ul>
      )}

      {borrador ? (
        // noValidate: los errores los da el servidor, en el aviso de abajo, no la burbuja del navegador.
        <form onSubmit={guardar} noValidate className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4">
          <Field label="Nombre" required>
            <Input
              value={borrador.nombre}
              maxLength={60}
              required
              autoComplete="off"
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
            />
          </Field>
          <Field
            label="Entretenimiento"
            optional
            hint="Enlace de una lista o un video de YouTube. Sin enlace, la pantalla muestra «Bienvenido»."
          >
            <Input
              type="url"
              inputMode="url"
              value={borrador.youtube}
              autoComplete="off"
              onChange={(e) => setBorrador({ ...borrador, youtube: e.target.value })}
              placeholder="https://www.youtube.com/playlist?list=…"
            />
          </Field>
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1.5 text-[13px] leading-5 font-medium text-neutral-700">
              Datos del turno llamado <span className="font-normal text-neutral-500">(el número siempre sale)</span>
            </legend>
            <DataTable
              caption="Datos del turno llamado que se muestran y se anuncian"
              density="compact"
              rowKey={(f) => f.campo}
              rows={CAMPOS}
              columns={[
                {
                  key: "dato",
                  header: "Dato",
                  render: (f) => (
                    <>
                      <span className="text-neutral-800">{f.etiqueta}</span>{" "}
                      <span className="text-xs text-neutral-500">({f.ejemplo})</span>
                    </>
                  ),
                },
                ...(["mostrar", "anunciar"] as const).map((donde) => ({
                  key: donde,
                  header: donde === "mostrar" ? "Mostrar" : "Anunciar por voz",
                  className: "w-36 text-center",
                  render: (f: (typeof CAMPOS)[number]) => (
                    <input
                      type="checkbox"
                      className="size-4 accent-blue-600"
                      aria-label={`${donde === "mostrar" ? "Mostrar" : "Anunciar por voz"}: ${f.etiqueta}`}
                      checked={borrador[donde][f.campo]}
                      onChange={(e) =>
                        setBorrador({ ...borrador, [donde]: { ...borrador[donde], [f.campo]: e.target.checked } })
                      }
                    />
                  ),
                })),
              ]}
            />
            <p className="text-xs text-neutral-500">Se anunciará: {ejemploAnuncio(borrador.anunciar)}</p>
            {exponen.length > 0 && (
              <Alert tone="warning">
                {exponen.join(" y ").replace(/^./, (c) => c.toUpperCase())}{" "}
                {exponen.length > 1 ? "quedan visibles" : "queda visible"} para cualquiera que tenga el enlace de esta
                pantalla.
              </Alert>
            )}
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              className="size-4 accent-blue-600"
              checked={borrador.activa}
              onChange={(e) => setBorrador({ ...borrador, activa: e.target.checked })}
            />
            Activa
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setBorrador(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              Guardar pantalla
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setBorrador({
                pantallaId: null,
                nombre: "Pantalla sala de espera",
                activa: true,
                youtube: "",
                mostrar: casillas(undefined),
                anunciar: casillas(undefined),
              });
              setError(null);
            }}
          >
            Agregar pantalla
          </Button>
        </div>
      )}
    </FormSection>
  );
}
