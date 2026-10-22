"use client";

// Feedback universal idle→loading→success/error (pedido explicito del
// rediseño Nexo Enterprise UI, 2026-09-07 — ej. guardar empleado, guardar
// jornada, configuración de marca). NexoShell monta `<ToastProvider>` una
// sola vez por app; cualquier Client Component debajo llama
// `useToast().show(...)`.
//
// Implementacion: envuelve `sonner`, no un context/estado propio — RRHH y
// CRM YA tenian `sonner` como dependencia real y en uso
// (apps/crm/src/components/ClienteForm.tsx, DeleteClienteButton.tsx) con
// su propio `<Toaster>` montado en el layout raiz. Construir un Toast
// nuevo desde cero hubiera duplicado un sistema que ya funcionaba (regla
// obligatoria "no dupliques" de CLAUDE.md) — en vez de eso, este archivo
// es el UNICO lugar de la suite que importa "sonner" directamente; los
// `<Toaster>` sueltos de los layouts raiz de rrhh/crm se retiraron a favor
// de este, montado una vez dentro de NexoShell.
//
// v2 (2026-10-20): toast CLARO con los tokens de la suite (antes era oscuro
// con hex fijos). Las variables de color de sonner se sobrescriben en el
// `style` del contenedor (gana sobre su hoja de estilos): blanco con borde
// neutral-200 para el informativo; verde/rojo suave (richColors) para exito y
// error, siempre texto tono-800 sobre tono-50. Tipografia Inter (la misma del
// chrome compartido), no la fuente de sistema que trae sonner.
import type { CSSProperties } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { shellFont } from "./shell-font";

export type ToastTone = "success" | "error" | "info";

const TOASTER_STYLE = {
  fontFamily: shellFont.style.fontFamily,
  "--normal-bg": "var(--nexo-enterprise-surface)",
  "--normal-border": "var(--nexo-enterprise-border)",
  "--normal-text": "var(--color-neutral-900)",
  "--success-bg": "var(--color-emerald-50)",
  "--success-border": "var(--color-emerald-200)",
  "--success-text": "var(--color-emerald-800)",
  "--error-bg": "var(--color-red-50)",
  "--error-border": "var(--color-red-200)",
  "--error-text": "var(--color-red-800)",
  "--info-bg": "var(--color-blue-50)",
  "--info-border": "var(--color-blue-200)",
  "--info-text": "var(--color-blue-800)",
  "--warning-bg": "var(--color-amber-50)",
  "--warning-border": "var(--color-amber-200)",
  "--warning-text": "var(--color-amber-800)",
  "--border-radius": "var(--radius-xl)",
} as CSSProperties;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* La region viva la provee sonner: su <section> contenedora queda
          siempre montada con aria-live="polite" (sonner 2.0.8). No envolver
          en otro role="status"/aria-live o los toasts se anunciarian dos
          veces; aca solo se traduce su nombre accesible. "Avisos" y no
          "Notificaciones": ese nombre ya lo tiene la campana del topbar. */}
      <SonnerToaster
        position="top-right"
        theme="light"
        richColors
        containerAriaLabel="Avisos"
        style={TOASTER_STYLE}
      />
    </>
  );
}

export function useToast(): { show: (text: string, tone?: ToastTone) => void } {
  return {
    show: (text, tone = "info") => {
      if (tone === "success") sonnerToast.success(text);
      else if (tone === "error") sonnerToast.error(text);
      else sonnerToast(text);
    },
  };
}
