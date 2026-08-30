// Shell bar persistente, inspirada en el "shell bar" de SAP Fiori (ver
// docs/planning/DISENO_UX_UI.md): barra oscura siempre visible, marca a la
// izquierda, usuario + accion de salir a la derecha. Chrome neutral de la
// suite — cada modulo mantiene su propia identidad visual puertas adentro.
//
// backHref (ver docs/DESIGN_SYSTEM.md): todo modulo autenticado pasa esto
// para cumplir la regla de "volver al panel" siempre visible.
//
// Este componente ES la barra superior persistente de la suite — no un
// accesorio opcional. Ningun modulo construye su propio header que la
// reemplace (ver docs/planning/NORMA_DISENO_UNIVERSAL.md §2.1): la
// identidad propia de cada modulo va en el CONTENIDO, debajo de esta
// barra, nunca en la barra misma.

import Link from "next/link";
import { BackToPanelLink } from "./BackToPanelLink";

export interface ShellBarProps {
  title: string;
  /** Si se pasa, el titulo enlaza ahi (ej. la home del propio modulo,
   * "/clientes" en el CRM) — navegacion dentro del mismo modulo, por eso
   * usa next/link y no un <a> plano como BackToPanelLink. */
  titleHref?: string;
  userEmail?: string | null;
  /** URL absoluta del panel — si se pasa, muestra "← Nexo" a la izquierda
   * del titulo. Omitir solo en el panel mismo (no hay a donde volver). */
  backHref?: string;
  /** Server action (form action) para cerrar sesion. */
  onSignOut?: () => void | Promise<void>;
}

export function ShellBar({
  title,
  titleHref,
  userEmail,
  backHref,
  onSignOut,
}: ShellBarProps) {
  const titleEl = titleHref ? (
    <Link href={titleHref} className="hover:text-neutral-200">
      {title}
    </Link>
  ) : (
    title
  );

  return (
    <div className="flex items-center justify-between bg-neutral-900 px-6 py-3 text-neutral-50">
      <div className="flex items-center gap-4">
        {backHref && (
          <>
            <BackToPanelLink href={backHref} />
            <span aria-hidden="true" className="text-neutral-700">
              /
            </span>
          </>
        )}
        <span className="text-sm font-semibold tracking-tight">{titleEl}</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-neutral-300">
        {userEmail && <span>{userEmail}</span>}
        {onSignOut && (
          <form action={onSignOut}>
            <button
              type="submit"
              className="underline underline-offset-2 hover:text-white"
            >
              Salir
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
