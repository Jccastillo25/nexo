import { Suspense } from "react";
import type { Metadata } from "next";
import { BulletIcon } from "@nexo/ui";
import LoginForm from "./LoginForm";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Ingresar · Nexo",
};

// Estilo alineado a la referencia visual del usuario (login oscuro, layout
// partido con logo + bullets). Todo el contenido (logo, imagen de fondo,
// textos, bullets, copyright) es editable desde /ajustes — ver
// supabase/migrations/20260830000011_platform_settings.sql y
// src/lib/platform-settings.ts (con sus defaults si la RPC falla). El
// negro queda reservado a esta pantalla — el resto de la suite (ShellBar
// incluido) usa la paleta clara.
export default async function LoginPage() {
  const supabase = await createClient();
  const settings = await getPlatformSettings(supabase);

  return (
    <div
      className="flex min-h-full flex-1 bg-neutral-950 bg-cover bg-center"
      style={
        settings.loginBackgroundUrl
          ? { backgroundImage: `url(${settings.loginBackgroundUrl})` }
          : undefined
      }
    >
      <div
        className={
          settings.loginBackgroundUrl
            ? "flex min-h-full flex-1 bg-neutral-950/70 backdrop-blur-sm"
            : "flex min-h-full flex-1"
        }
      >
        <div className="hidden w-1/2 flex-col justify-center px-16 lg:flex">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
            {settings.eyebrowText}
          </p>
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt={settings.headingText}
              className="mt-3 h-10 w-auto object-contain object-left"
            />
          ) : (
            <h1 className="mt-2 text-4xl font-bold text-neutral-50">
              {settings.headingText}
            </h1>
          )}
          <p className="mt-4 max-w-sm text-sm text-neutral-400">
            {settings.tagline}
          </p>

          <div className="mt-10 flex flex-col gap-6">
            {settings.bullets.map((bullet) => (
              <div key={bullet.title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-blue-500">
                  <BulletIcon name={bullet.icon} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-100">
                    {bullet.title}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {bullet.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 lg:w-1/2 lg:flex-none">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center lg:hidden">
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                {settings.eyebrowText}
              </p>
              {settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logoUrl}
                  alt={settings.headingText}
                  className="mx-auto mt-3 h-9 w-auto object-contain"
                />
              ) : (
                <h1 className="mt-2 text-3xl font-bold text-neutral-50">
                  {settings.headingText}
                </h1>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl sm:p-8">
              <h2 className="mb-6 text-lg font-semibold text-neutral-50">
                Iniciar sesión
              </h2>
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-neutral-600">
            {settings.copyrightText}
          </p>
        </div>
      </div>
    </div>
  );
}
