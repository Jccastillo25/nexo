// Parte de la regla de diseno obligatoria de la suite — ver
// docs/DESIGN_SYSTEM.md. Todo modulo autenticado tiene que ofrecer una
// forma persistente de volver a la grilla de modulos de Nexo; este es el
// componente compartido para no reinventarlo en cada modulo.
//
// Es un <a> plano a proposito (no next/link): cruzar de un modulo al
// panel es cruzar de zona en Next.js Multi-Zones, siempre implica una
// navegacion real del navegador, nunca client-side routing.

export interface BackToPanelLinkProps {
  /** URL absoluta del panel (apps/nexo) — ver getPanelUrl() en cada app. */
  href: string;
  /** Texto del link. Por defecto "Nexo" (el usuario ya esta "dentro" del
   * modulo, no hace falta repetir "volver a"). */
  label?: string;
  /** Override de estilo para pantallas fuera de ShellBar (ver
   * sin-acceso/page.tsx). Sin esto, un estilo neutro pensado para el
   * fondo claro de ShellBar (el negro quedó reservado para el login). */
  className?: string;
}

const DEFAULT_CLASS =
  "inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900";

export function BackToPanelLink({
  href,
  label = "Nexo",
  className,
}: BackToPanelLinkProps) {
  return (
    <a href={href} className={className ?? DEFAULT_CLASS}>
      <span aria-hidden="true">←</span>
      {label}
    </a>
  );
}
