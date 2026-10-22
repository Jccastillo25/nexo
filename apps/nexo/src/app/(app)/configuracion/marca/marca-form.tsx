"use client";

import { useActionState, useRef, useState } from "react";
import {
  Alert,
  BulletIcon,
  BULLET_ICON_NAMES,
  Button,
  Field,
  FormSection,
  Input,
  NexoIcon,
  Select,
  useToast,
} from "@nexo/ui";
// Solo tipos: @nexo/auth es server-only, pero un `import type` se borra al compilar.
import type { PlatformBullet, PlatformSettings } from "@nexo/auth";
import { updateSettings, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = { error: null, success: false };

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
    <Field
      label={label}
      hint={`${hint ? `${hint} ` : ""}PNG, JPG, WEBP, GIF o ICO — máx. ${MAX_IMAGE_MB_LABEL}.`}
      error={fieldError}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex h-16 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : currentUrl && !remove ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-neutral-500">Sin imagen</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            ref={inputRef}
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
                setFieldError(`Formato no permitido (${file.type || "desconocido"}). Usa PNG, JPG, WEBP, GIF o ICO.`);
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
            className="py-1 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
          />
          {currentUrl && (
            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
              <input
                type="checkbox"
                name={removeName}
                className="size-4 accent-blue-600"
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
    </Field>
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
      // El texto del rechazo (p. ej. límite de tamaño del body) no se
      // muestra: va a la consola y la pantalla recibe un mensaje propio.
      console.error("MarcaForm: updateSettings", err);
      const message = "No se pudo guardar la configuración. Revisa el tamaño de las imágenes e intenta de nuevo.";
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
          <Field label="Texto pequeño (arriba del nombre)">
            <Input name="eyebrow_text" defaultValue={initial.eyebrowText} />
          </Field>
          <Field label="Nombre (se oculta si hay logo)">
            <Input name="heading_text" defaultValue={initial.headingText} />
          </Field>
          <Field label="Tagline">
            <Input name="tagline" defaultValue={initial.tagline} />
          </Field>
        </FormSection>

        <FormSection title="Bullets del login">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-neutral-500">Lista de beneficios a la izquierda del login.</span>
            <Button variant="secondary" size="sm" onClick={addBullet}>
              Agregar bullet
            </Button>
          </div>

          {bullets.length === 0 && (
            <p className="text-xs text-neutral-500">Sin bullets — el login se muestra sin la lista de la izquierda.</p>
          )}

          {bullets.map((bullet, i) => (
            <fieldset key={i} className="flex min-w-0 flex-col gap-2 rounded-lg border border-neutral-200 p-3">
              <legend className="sr-only">Bullet {i + 1}</legend>
              <div className="flex flex-wrap items-center gap-2">
                {/* El ancho va en un contenedor: el de Select ya trae w-full. */}
                <div className="w-36 shrink-0">
                  <Select
                    value={bullet.icon}
                    onChange={(e) => updateBullet(i, { icon: e.target.value })}
                    aria-label={`Icono del bullet ${i + 1}`}
                  >
                    {BULLET_ICON_NAMES.map((iconName) => (
                      <option key={iconName} value={iconName}>
                        {iconName}
                      </option>
                    ))}
                  </Select>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <BulletIcon name={bullet.icon} className="h-4 w-4" />
                </span>
                <Input
                  value={bullet.title}
                  onChange={(e) => updateBullet(i, { title: e.target.value })}
                  placeholder="Título"
                  aria-label={`Título del bullet ${i + 1}`}
                  className="flex-1 basis-40"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBullet(i)}
                  aria-label={`Eliminar bullet ${i + 1}`}
                  icon={<NexoIcon name="x" />}
                />
              </div>
              <Input
                value={bullet.description}
                onChange={(e) => updateBullet(i, { description: e.target.value })}
                placeholder="Descripción"
                aria-label={`Descripción del bullet ${i + 1}`}
              />
            </fieldset>
          ))}
        </FormSection>

        <FormSection title="Copyright (toda la plataforma)">
          <Field
            label="Texto de copyright"
            hint={
              <>
                Se muestra tal cual en el pie del login, del panel y de cada módulo — incluye el año si quieres que
                aparezca (ej. &quot;© 2026 Grupo CT&quot;).
              </>
            }
          >
            <Input name="copyright_text" defaultValue={initial.copyrightText} />
          </Field>
        </FormSection>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">Configuración de marca guardada correctamente.</Alert> : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={handleCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={isPending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
