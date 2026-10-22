"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Field, FormSection, Input, Select, useToast } from "@nexo/ui";
import type { AppGrupo } from "@/lib/permisos-catalogo";
import type { PlantillaRol } from "@/lib/supabase/database.types";
import { guardarRol } from "./actions";

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
  // Tres lugares para un error: junto al nombre, en la sección de
  // aplicaciones ("activa al menos una") o al pie (el resto).
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorApps, setErrorApps] = useState<string | null>(null);
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
    setErrorApps(null);
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
    show(`Plantilla "${plantilla.label}" cargada en ${app.nombre}. Revísala antes de guardar.`, "info");
  }

  function togglePermiso(code: string, marcado: boolean) {
    actualizar((s) => (marcado ? s.add(code) : s.delete(code)));
  }

  function guardar() {
    setError(null);
    const nombreLimpio = nombre.trim();
    const sinNombre = nombreLimpio.length < 2;
    const sinApps = !apps.some(appActiva);
    setErrorNombre(sinNombre ? "Escribe un nombre para el rol (mínimo 2 caracteres)." : null);
    setErrorApps(sinApps ? "Activa al menos una aplicación." : null);
    if (sinNombre || sinApps) return;

    startTransition(async () => {
      try {
        const res = await guardarRol({
          rolId: inicial?.id ?? null,
          nombre: nombreLimpio,
          descripcion,
          permisos: Array.from(seleccion),
        });
        if (!res.ok) {
          const message = res.message ?? "No se pudo guardar el rol.";
          if (res.campo === "nombre") setErrorNombre(message);
          else setError(message);
          show(message, "error");
          return;
        }
        show(inicial ? "Rol actualizado." : "Rol creado.", "success");
        router.push("/configuracion/roles");
      } catch (err) {
        // Rechazo de transporte o error inesperado: el detalle va a la consola,
        // nunca a la pantalla.
        console.error("RolForm: guardar", err);
        const message = "No se pudo guardar el rol. Intenta de nuevo.";
        setError(message);
        show(message, "error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Datos del rol">
        <Field label="Nombre del rol" required error={errorNombre}>
          <Input
            value={nombre}
            maxLength={80}
            onChange={(e) => {
              setNombre(e.target.value);
              setErrorNombre(null);
            }}
            placeholder="Recepcionista sucursal central"
          />
        </Field>
        <Field label="Descripción" optional>
          <Input value={descripcion} maxLength={500} onChange={(e) => setDescripcion(e.target.value)} />
        </Field>
      </FormSection>

      <FormSection
        title="Aplicaciones y permisos"
        description="Activa cada aplicación a la que tiene acceso el rol y marca lo que puede hacer dentro de ella."
      >
        {errorApps ? <Alert tone="error">{errorApps}</Alert> : null}
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
                    className="size-4 accent-blue-600"
                  />
                  {app.nombre}
                </label>
                {activa ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700">
                      {cantidad} {cantidad === 1 ? "permiso" : "permisos"}
                    </span>
                    {plantillasApp.length > 0 && (
                      <Select
                        value=""
                        onChange={(e) => cargarPlantilla(app, e.target.value)}
                        aria-label={`Cargar plantilla de ${app.nombre}`}
                        className="w-full sm:w-52"
                      >
                        <option value="">Cargar plantilla…</option>
                        {plantillasApp.map((p) => (
                          <option key={p.role_key} value={p.role_key}>
                            {p.label}
                          </option>
                        ))}
                      </Select>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => marcarTodo(app, true)}>
                      Marcar todo
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => marcarTodo(app, false)}>
                      Quitar todo
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-500">Sin acceso</span>
                )}
              </div>

              {activa && (
                <div className="flex flex-col gap-4 border-t border-neutral-100 px-4 py-3">
                  {app.dominios.length === 0 && (
                    <p className="text-xs text-neutral-500">Esta aplicación no tiene permisos internos registrados.</p>
                  )}
                  {app.dominios.map((dominio) => (
                    <div key={dominio.key} className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
                                title={p.description ?? undefined}
                                className="flex items-center gap-1.5 text-sm text-neutral-600"
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 accent-blue-600"
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

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/configuracion/roles" variant="secondary">
          Cancelar
        </ButtonLink>
        <Button onClick={guardar} loading={isPending}>
          Guardar rol
        </Button>
      </div>
    </div>
  );
}
