import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Ingresar · Nexo",
};

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ShieldIcon() {
  return (
    <IconBase>
      <path d="M10 2.5 16 5v5c0 4-2.6 6.6-6 7.5-3.4-.9-6-3.5-6-7.5V5l6-2.5Z" />
      <path d="M7.3 10 9.2 12l3.5-4" />
    </IconBase>
  );
}

function LoginKeyIcon() {
  return (
    <IconBase>
      <circle cx="7" cy="10" r="3.2" />
      <path d="M9.8 10h7.7M14.5 10v3M17 10v2.3" />
    </IconBase>
  );
}

function LayersIcon() {
  return (
    <IconBase>
      <path d="M10 3 17 7l-7 4-7-4 7-4Z" />
      <path d="M3 10.5 10 14.5 17 10.5M3 14 10 18l7-4" />
    </IconBase>
  );
}

const BULLETS = [
  {
    icon: ShieldIcon,
    title: "Permisos por módulo",
    description: "Cada cuenta ve únicamente lo que tiene habilitado.",
  },
  {
    icon: LoginKeyIcon,
    title: "Un solo inicio de sesión",
    description: "Entrá a todos los módulos sin volver a loguearte.",
  },
  {
    icon: LayersIcon,
    title: "Todo en un solo panel",
    description: "CRM, RRHH y Flotilla, unificados en un mismo lugar.",
  },
];

// Estilo alineado a la referencia visual del usuario (login oscuro, layout
// partido con logo + bullets) — sin la foto de fondo: Nexo es una
// herramienta interna, no un SaaS que necesite venderse a sí mismo. El
// negro queda reservado a esta pantalla — el resto de la suite (ShellBar
// incluido) usa la paleta clara.
export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 bg-neutral-950">
      <div className="hidden w-1/2 flex-col justify-center px-16 lg:flex">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          Grupo CT
        </p>
        <h1 className="mt-2 text-4xl font-bold text-neutral-50">Nexo</h1>
        <p className="mt-4 max-w-sm text-sm text-neutral-400">
          El panel unificado de Materiales J Castillo / Grupo CT.
        </p>

        <div className="mt-10 flex flex-col gap-6">
          {BULLETS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-blue-500">
                <Icon />
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-100">{title}</p>
                <p className="text-sm text-neutral-500">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16 lg:w-1/2 lg:flex-none">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
              Grupo CT
            </p>
            <h1 className="mt-2 text-3xl font-bold text-neutral-50">Nexo</h1>
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
      </div>
    </div>
  );
}
