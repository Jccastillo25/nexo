"use client";

import { useActionState, useState } from "react";
import { BulletIcon, BULLET_ICON_NAMES } from "@nexo/ui";
import { updateSettings, type SettingsFormState } from "./actions";
import type { PlatformBullet, PlatformSettings } from "@/lib/platform-settings";

const initialState: SettingsFormState = { error: null, success: false };

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "text-xs font-medium uppercase tracking-wide text-neutral-500";

function ImageField({
  name,
  label,
  currentUrl,
  removeName,
}: {
  name: string;
  label: string;
  currentUrl: string | null;
  removeName: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>{label}</span>
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
            type="file"
            name={name}
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setRemove(false);
                setPreview(URL.createObjectURL(file));
              }
            }}
            className="text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
          />
          {currentUrl && (
            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              <input
                type="checkbox"
                name={removeName}
                checked={remove}
                onChange={(e) => {
                  setRemove(e.target.checked);
                  if (e.target.checked) setPreview(null);
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

export default function AjustesForm({
  initial,
}: {
  initial: PlatformSettings;
}) {
  const [state, formAction, isPending] = useActionState(
    updateSettings,
    initialState
  );
  const [bullets, setBullets] = useState<PlatformBullet[]>(initial.bullets);

  function updateBullet(index: number, patch: Partial<PlatformBullet>) {
    setBullets((prev) =>
      prev.map((b, i) => (i === index ? { ...b, ...patch } : b))
    );
  }

  function removeBullet(index: number) {
    setBullets((prev) => prev.filter((_, i) => i !== index));
  }

  function addBullet() {
    setBullets((prev) => [
      ...prev,
      { icon: "shield", title: "", description: "" },
    ]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="bullets_json" value={JSON.stringify(bullets)} />

      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Imágenes</h2>
        <ImageField
          name="logo"
          removeName="logo_remove"
          label="Logo"
          currentUrl={initial.logoUrl}
        />
        <ImageField
          name="background"
          removeName="background_remove"
          label="Imagen de fondo del login"
          currentUrl={initial.loginBackgroundUrl}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Textos del login</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="eyebrow_text" className={labelClass}>
            Texto pequeño (arriba del nombre)
          </label>
          <input
            id="eyebrow_text"
            name="eyebrow_text"
            defaultValue={initial.eyebrowText}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="heading_text" className={labelClass}>
            Nombre (se oculta si hay logo)
          </label>
          <input
            id="heading_text"
            name="heading_text"
            defaultValue={initial.headingText}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="tagline" className={labelClass}>
            Tagline
          </label>
          <input
            id="tagline"
            name="tagline"
            defaultValue={initial.tagline}
            className={inputClass}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">
            Bullets del login
          </h2>
          <button
            type="button"
            onClick={addBullet}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            + agregar bullet
          </button>
        </div>

        {bullets.length === 0 && (
          <p className="text-xs text-neutral-400">
            Sin bullets — el login se muestra sin la lista de la izquierda.
          </p>
        )}

        {bullets.map((bullet, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3"
          >
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
              onChange={(e) =>
                updateBullet(i, { description: e.target.value })
              }
              placeholder="Descripción"
              className={inputClass}
            />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">
          Copyright (toda la plataforma)
        </h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="copyright_text" className={labelClass}>
            Texto de copyright
          </label>
          <input
            id="copyright_text"
            name="copyright_text"
            defaultValue={initial.copyrightText}
            className={inputClass}
          />
          <p className="text-xs text-neutral-400">
            Se muestra tal cual en el pie del login, del panel y de cada
            módulo — incluí el año si querés que aparezca (ej. "© 2026 Grupo
            CT").
          </p>
        </div>
      </section>

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Guardado.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
