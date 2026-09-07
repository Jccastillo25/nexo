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
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

export type ToastTone = "success" | "error" | "info";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SonnerToaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#171717",
            color: "#FAFAFA",
            border: "1px solid #404040",
          },
        }}
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
