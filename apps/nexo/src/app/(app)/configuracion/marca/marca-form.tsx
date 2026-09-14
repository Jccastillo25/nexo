"use client";

import { useActionState, useRef, useState } from "react";
import { BulletIcon, BULLET_ICON_NAMES, FormSection, useToast } from "@nexo/ui";
import { updateSettings, type SettingsFormState } from "./actions";
import type { PlatformBullet, PlatformSettings } from "@/lib/platform-settings";

const initialState: SettingsFormState = { error: null, success: false };

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

// Debe coincidir con el limite del Server Action (actions.ts,
// MAX_IMAGE_BYTES) — esta validacion en el cliente es solo UX (evita el
// viaje al servidor y muestra el error sin mover la pantalla); la que de
// verdad protege es la del Server Action.
const MAX_IMAGE_BYTES = 1.25 * 1024 * 1024; // 1.25 MB
const MAX_IMAGE_MB_LABEL = "1.25 MB";
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function ImageField({
  name,
  label,
  hint,
  currentUrl,
  removeName,
}: {
  name: string;
  label: string;
  hint?: string;
  currentUrl: string | null;
  removeName: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>{label}</span>
      <p className="text-xs text-neutral-400">
        {hint ? `${hint} ` : ""}PNG, JPG, WEBP, GIF o ICO — máx. {MAX_IMAGE_MB_LABEL}.
      </p>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-neutral-300 bg-neutral-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : currentUrl && !remove ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-neutral-400">Sin imagen</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
                setFieldError(`Formato no permitido (${file.type || "desconocido"}). Usá PNG, JPG, WEBP, GIF o ICO.`);
                if (inputRef.current) inputRef.current.value = "";
                return;
              }
              if (file.size > MAX_IMAGE_BYTES) {
                setFieldError(`La imagen pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB, el máximo permitido es ${MAX_IMAGE_MB_LABEL}.`);
                if (inputRef.current) inputRef.current.value = "";
                return;
              }

              setFieldError(null);
              setRemove(false);
              setPreview(URL.createObjectURL(file));
            }}
            className="text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
          />
          {fieldError && (
            <p role="alert" className="text-xs text-red-600">
              {fieldError}
            </p>
          )}
          {currentUrl && (
            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              <input
                type="checkbox"
                name={removeName}
                checked={remove}
                onChange={(e) => {
                  setRemove(e.target.checked);
                  if (e.target.checked) {
                    setPreview(null);
                    setFieldError(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }
                }}
              />
              Quitar imagen actual
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Editor de core.platform_settings — logo, imagen de fondo, favicon,
 * textos/bullets del login y copyright de toda la plataforma. Movido de
 * /ajustes a /configuracion/marca (Nexo Enterprise UI, 2026-09-07) —
 * misma logica de subida (Storage `platform-assets`, upsert + cache-bust),
 * ahora con feedback via useToast ademas del mensaje inline existente
 * (regla obligatoria §1.10: idle→loading→success/error).
 */
export default function MarcaForm({ initial }: { initial: PlatformSettings }) {
  const { show } = useToast();
  const [state, formAction, isPending] = useActionState(async (prev: SettingsFormState, fd: FormData) => {
    // P0 (2026-09-14): el Server Action puede rechazarse a nivel de
    // transporte (ej. límite de tamaño de body) antes de que updateSettings
    // llegue a ejecutarse — eso llega acá como una promesa rechazada, no
    // como un SettingsFormState. Sin este try/catch, ese rechazo tumbaba la
    // pantalla completa contra el error boundary global en vez de quedar
    // contenido en el formulario.
    try {
      const res = await updateSettings(prev, fd);
      if (res.error) show(res.error, "error");
      else if (res.success) show("Configuración de marca guardada correctamente.", "success");
      return res;
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "No se pudo guardar la configuración. Intentá de nuevo.";
      show(message, "error");
      return { error: message, success: false };
    }
  }, initialState);
  const [bullets, setBullets] = useState<PlatformBullet[]>(initial.bullets);
  // Se incrementa en "Cancelar" para remontar los campos no controlados
  // (inputs de archivo/preview de ImageField, defaultValue de los inputs de
  // texto) y que vuelvan exactamente al valor persistido — sin esto, un
  // <input type="file"> no se puede limpiar por programación salvo
  // remontándolo.
  const [formKey, setFormKey] = useState(0);

  function updateBullet(index: number, patch: Partial<PlatformBullet>) {
    setBullets((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function removeBullet(index: number) {
    setBullets((prev) => prev.filter((_, i) => i !== index));
  }

  function addBullet() {
    setBullets((prev) => [...prev, { icon: "shield", title: "", description: "" }]);
  }

  function handleCancel() {
    setBullets(initial.bullets);
    setFormKey((k) => k + 1);
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="bullets_json" value={JSON.stringify(bullets)} />
      <div key={formKey} className="flex flex-col gap-6">

      <FormSection title="Imágenes">
        <ImageField name="logo" removeName="logo_remove" label="Logo" currentUrl={initial.logoUrl} />
        <ImageField
          name="background"
          removeName="background_remove"
          label="Imagen de fondo del login"
          currentUrl={initial.loginBackgroundUrl}
        />
        <ImageField
          name="favicon"
          removeName="favicon_remove"
          label="Favicon"
          hint="Fuente recomendada 512×512 (PNG/ICO) — se sirve el mismo archivo para todos los tamaños del navegador."
          currentUrl={initial.faviconUrl}
        />
      </FormSection>

      <FormSection title="Textos del login">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="eyebrow_text" className={labelClass}>
            Texto pequeño (arriba del nombre)
          </label>
          <input id="eyebrow_text" name="eyebrow_text" defaultValue={initial.eyebrowText} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="heading_text" className={labelClass}>
            Nombre (se oculta si hay logo)
          </label>
          <input id="heading_text" name="heading_text" defaultValue={initial.headingText} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="tagline" className={labelClass}>
            Tagline
          </label>
          <input id="tagline" name="tagline" defaultValue={initial.tagline} className={inputClass} />
        </div>
      </FormSection>

      <FormSection title="Bullets del login">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">Lista de beneficios a la izquierda del login.</span>
          <button type="button" onClick={addBullet} className="text-xs font-medium text-blue-600 hover:text-blue-700">
            + agregar bullet
          </button>
        </div>

        {bullets.length === 0 && (
          <p className="text-xs text-neutral-400">Sin bullets — el login se muestra sin la lista de la izquierda.</p>
        )}

        {bullets.map((bullet, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
            <div className="flex items-center gap-2">
              <select
                value={bullet.icon}
                onChange={(e) => updateBullet(i, { icon: e.target.value })}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                {BULLET_ICON_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                <BulletIcon name={bullet.icon} className="h-4 w-4" />
              </span>
              <input
                value={bullet.title}
                onChange={(e) => updateBullet(i, { title: e.target.value })}
                placeholder="Título"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeBullet(i)}
                aria-label="Eliminar bullet"
                className="shrink-0 rounded-md border border-neutral-200 px-2 py-1.5 text-xs text-neutral-500 hover:border-red-300 hover:text-red-700"
              >
                ✕
              </button>
            </div>
            <input
              value={bullet.description}
              onChange={(e) => updateBullet(i, { description: e.target.value })}
              placeholder="Descripción"
              className={inputClass}
            />
          </div>
        ))}
      </FormSection>

      <FormSection title="Copyright (toda la plataforma)">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="copyright_text" className={labelClass}>
            Texto de copyright
          </label>
          <input id="copyright_text" name="copyright_text" defaultValue={initial.copyrightText} className={inputClass} />
          <p className="text-xs text-neutral-400">
            Se muestra tal cual en el pie del login, del panel y de cada
            módulo — incluí el año si querés que aparezca (ej. "© 2026 Grupo
            CT").
          </p>
        </div>
      </FormSection>
      </div>

      {state.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Configuración de marca guardada correctamente.
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
