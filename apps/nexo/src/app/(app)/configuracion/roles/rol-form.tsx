"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormSection, useToast } from "@nexo/ui";
import type { AppGrupo } from "@/lib/permisos-catalogo";
import type { PlantillaRol } from "@/lib/supabase/database.types";
import { guardarRol } from "./actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

export interface RolFormProps {
  apps: AppGrupo[];
  plantillas: PlantillaRol[];
  inicial: { id: string; nombre: string; descripcion: string | null; permisos: string[] } | null;
}

/**
 * Editor de rol — opción A (todo en una pantalla), elegida por el usuario
 * tras probar el prototipo A/B (2026-10-14): al activar una app se
 * despliegan sus permisos internos debajo, agrupados por dominio y recurso.
 * Activar la app = incluir `<app>.ver_modulo` en el rol; desactivarla quita
 * todos los permisos de esa app.
 */
export default function RolForm({ apps, plantillas, inicial }: RolFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set(inicial?.permisos ?? []));
  const [error, setError] = useState<string | null>(null);

  const plantillasPorApp = useMemo(() => {
    const mapa = new Map<string, PlantillaRol[]>();
    for (const p of plantillas) {
      mapa.set(p.module_slug, [...(mapa.get(p.module_slug) ?? []), p]);
    }
    return mapa;
  }, [plantillas]);

  function appActiva(app: AppGrupo): boolean {
    return app.accesoCode ? seleccion.has(app.accesoCode) : app.codes.some((c) => seleccion.has(c));
  }

  function actualizar(cambio: (s: Set<string>) => void) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      cambio(next);
      return next;
    });
    setError(null);
  }

  function toggleApp(app: AppGrupo, activa: boolean) {
    actualizar((s) => {
      if (activa) {
        if (app.accesoCode) s.add(app.accesoCode);
      } else {
        app.codes.forEach((c) => s.delete(c));
      }
    });
  }

  function marcarTodo(app: AppGrupo, marcar: boolean) {
    actualizar((s) => {
      app.codes.forEach((c) => (marcar ? s.add(c) : s.delete(c)));
      if (!marcar && app.accesoCode) s.add(app.accesoCode);
    });
  }

  function cargarPlantilla(app: AppGrupo, roleKey: string) {
    const plantilla = plantillasPorApp.get(app.slug)?.find((p) => p.role_key === roleKey);
    if (!plantilla) return;
    actualizar((s) => {
      app.codes.forEach((c) => s.delete(c));
      plantilla.permisos.filter((c) => app.codes.includes(c)).forEach((c) => s.add(c));
      if (app.accesoCode) s.add(app.accesoCode);
    });
    show(`Plantilla "${plantilla.label}" cargada en ${app.nombre}. Revisala antes de guardar.`, "info");
  }

  function togglePermiso(code: string, marcado: boolean) {
    actualizar((s) => (marcado ? s.add(code) : s.delete(code)));
  }

  function guardar() {
    const nombreLimpio = nombre.trim();
    if (nombreLimpio.length < 2) {
      setError("Escribí un nombre para el rol (mínimo 2 caracteres).");
      return;
    }
    if (!apps.some(appActiva)) {
      setError("Activá al menos una aplicación.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await guardarRol({
          rolId: inicial?.id ?? null,
          nombre: nombreLimpio,
          descripcion,
          permisos: Array.from(seleccion),
        });
        if (!res.ok) {
          setError(res.message ?? "No se pudo guardar el rol.");
          show(res.message ?? "No se pudo guardar el rol.", "error");
          return;
        }
        show(inicial ? "Rol actualizado." : "Rol creado.", "success");
        router.push("/configuracion/roles");
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : "No se pudo guardar el rol.";
        setError(message);
        show(message, "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Datos del rol">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rol_nombre" className={labelClass}>
            Nombre del rol
          </label>
          <input
            id="rol_nombre"
            value={nombre}
            maxLength={80}
            onChange={(e) => {
              setNombre(e.target.value);
              setError(null);
            }}
            placeholder="Recepcionista sucursal central"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rol_descripcion" className={labelClass}>
            Descripción
          </label>
          <input
            id="rol_descripcion"
            value={descripcion}
            maxLength={500}
            onChange={(e) => setDescripcion(e.target.value)}
            className={inputClass}
          />
        </div>
      </FormSection>

      <FormSection
        title="Aplicaciones y permisos"
        description="Activá cada aplicación a la que tiene acceso el rol y marcá lo que puede hacer dentro de ella."
      >
        {apps.length === 0 && (
          <p className="text-sm text-neutral-500">No hay aplicaciones habilitadas para la empresa.</p>
        )}
        {apps.map((app) => {
          const activa = appActiva(app);
          const cantidad = app.codes.filter((c) => seleccion.has(c)).length;
          const plantillasApp = plantillasPorApp.get(app.slug) ?? [];
          return (
            <div key={app.slug} className="rounded-lg border border-neutral-200">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <input
                    type="checkbox"
                    checked={activa}
                    onChange={(e) => toggleApp(app, e.target.checked)}
                    className="h-4 w-4"
                  />
                  {app.nombre}
                </label>
                {activa ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700">
                      {cantidad} {cantidad === 1 ? "permiso" : "permisos"}
                    </span>
                    {plantillasApp.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => cargarPlantilla(app, e.target.value)}
                        aria-label={`Cargar plantilla de ${app.nombre}`}
                        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700"
                      >
                        <option value="">Cargar plantilla…</option>
                        {plantillasApp.map((p) => (
                          <option key={p.role_key} value={p.role_key}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => marcarTodo(app, true)}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
                    >
                      Marcar todo
                    </button>
                    <button
                      type="button"
                      onClick={() => marcarTodo(app, false)}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-50"
                    >
                      Quitar todo
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400">Sin acceso</span>
                )}
              </div>

              {activa && (
                <div className="flex flex-col gap-4 border-t border-neutral-100 px-4 py-3">
                  {app.dominios.length === 0 && (
                    <p className="text-xs text-neutral-400">Esta aplicación no tiene permisos internos registrados.</p>
                  )}
                  {app.dominios.map((dominio) => (
                    <div key={dominio.key} className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        {dominio.label}
                      </h3>
                      {dominio.recursos.map((recurso) => (
                        <div
                          key={recurso.key}
                          className="grid gap-x-4 gap-y-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start"
                        >
                          <span className="text-sm text-neutral-700">{recurso.label}</span>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {recurso.permisos.map((p) => (
                              <label
                                key={p.code}
                                title={p.description ?? p.code}
                                className="flex items-center gap-1.5 text-sm text-neutral-600"
                              >
                                <input
                                  type="checkbox"
                                  checked={seleccion.has(p.code)}
                                  onChange={(e) => togglePermiso(p.code, e.target.checked)}
                                />
                                {p.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </FormSection>

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Link
          href="/configuracion/roles"
          className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={guardar}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando…" : "Guardar rol"}
        </button>
      </div>
    </div>
  );
}
