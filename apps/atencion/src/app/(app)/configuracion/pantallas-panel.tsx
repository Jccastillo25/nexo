"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormSection, StatusBadge, useToast } from "@nexo/ui";
import { campoActivo, type CampoPantalla, type CamposPantalla, type Pantalla } from "@/lib/supabase/database.types";
import { guardarPantalla } from "./actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

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
export default function PantallasPanel({ sucursalId, pantallas }: { sucursalId: string; pantallas: Pantalla[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function enlace(id: string) {
    return `${window.location.origin}/atencion/pantalla/${id}`;
  }

  function guardar() {
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

  return (
    <FormSection
      title="Pantallas públicas"
      description="Muestran el turno llamado y los próximos números. En cada pantalla elegís qué datos del turno se ven y cuáles se anuncian por voz. Abrí el enlace en el televisor."
    >
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {pantallas.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="font-medium text-neutral-900">{p.nombre}</span>
              {!p.activa && <StatusBadge label="Inactiva" tone="neutral" />}
              {p.config.youtube && <StatusBadge label="Con entretenimiento" tone="info" />}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(enlace(p.id));
                  show("Enlace copiado.", "success");
                }}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                Copiar enlace
              </button>
              <Link href={`/pantalla/${p.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
                Abrir
              </Link>
              <button
                type="button"
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
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Editar
              </button>
            </div>
          </li>
        ))}
        {pantallas.length === 0 && <li className="px-4 py-4 text-sm text-neutral-500">Todavía no hay pantallas.</li>}
      </ul>

      {borrador ? (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Nombre
            <input value={borrador.nombre} maxLength={60} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Entretenimiento: lista o video de YouTube (opcional)
            <input
              value={borrador.youtube}
              onChange={(e) => setBorrador({ ...borrador, youtube: e.target.value })}
              placeholder="https://www.youtube.com/playlist?list=…"
              className={inputClass}
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs text-neutral-500">Datos del turno llamado (el número siempre sale)</legend>
            <table className="text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="py-1 font-medium">Dato</th>
                  <th className="px-3 py-1 text-center font-medium">Mostrar</th>
                  <th className="px-3 py-1 text-center font-medium">Anunciar por voz</th>
                </tr>
              </thead>
              <tbody>
                {CAMPOS.map(({ campo, etiqueta, ejemplo }) => (
                  <tr key={campo} className="border-t border-neutral-100">
                    <td className="py-1.5 text-neutral-800">
                      {etiqueta} <span className="text-xs text-neutral-400">({ejemplo})</span>
                    </td>
                    {(["mostrar", "anunciar"] as const).map((donde) => (
                      <td key={donde} className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${donde === "mostrar" ? "Mostrar" : "Anunciar"}: ${etiqueta}`}
                          checked={borrador[donde][campo]}
                          onChange={(e) => setBorrador({ ...borrador, [donde]: { ...borrador[donde], [campo]: e.target.checked } })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-neutral-500">Se anunciará: {ejemploAnuncio(borrador.anunciar)}</p>
            {expuestos(borrador).length > 0 && (
              <p className="text-xs text-amber-700">
                {expuestos(borrador).join(" y ").replace(/^./, (c) => c.toUpperCase())}{" "}
                {expuestos(borrador).length > 1 ? "quedan visibles" : "queda visible"} para cualquiera que tenga el enlace
                de esta pantalla.
              </p>
            )}
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={borrador.activa} onChange={(e) => setBorrador({ ...borrador, activa: e.target.checked })} />
            Activa
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setBorrador(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isPending ? "Guardando…" : "Guardar pantalla"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
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
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Agregar pantalla
          </button>
        </div>
      )}
    </FormSection>
  );
}
