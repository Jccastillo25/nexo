// Parte de la regla de diseno obligatoria de la suite — ver
// docs/DESIGN_SYSTEM.md. Usado en pantallas fuera del layout autenticado
// normal (ej. sin-acceso) que igual necesitan una forma de volver al App
// Launcher de Nexo — mismo componente compartido para no reinventarlo en
// cada modulo.
//
// Reconciliacion de navegacion 2026-09-14: la decision vigente elimino el
// patron de texto "Volver a Nexo" en toda la suite — el logo configurado
// en Marca (o el wordmark "N" por defecto) es ahora el propio link, igual
// que en la cabecera de NexoSidebar (ver NexoSidebar.tsx). Este componente
// ya no acepta un `label` de texto.
//
// Es un <a> plano a proposito (no next/link): cruzar de un modulo al
// panel es cruzar de zona en Next.js Multi-Zones, siempre implica una
// navegacion real del navegador, nunca client-side routing.

export interface BackToPanelLinkProps {
  /** URL absoluta del panel (apps/nexo) — ver getPanelUrl() en cada app. */
  href: string;
  /** core.platform_settings.logo_url — sin configurar, cae al wordmark
   * "N" por defecto (mismo patron que NexoSidebar). */
  logoUrl?: string | null;
  /** Override de estilo para pantallas fuera de NexoShell (ver
   * sin-acceso/page.tsx). */
  className?: string;
}

const DEFAULT_CLASS = "inline-flex items-center transition-opacity hover:opacity-80";
const ARIA_LABEL = "Volver al inicio de Nexo";

export function BackToPanelLink({ href, logoUrl, className }: BackToPanelLinkProps) {
  return (
    <a href={href} aria-label={ARIA_LABEL} className={className ?? DEFAULT_CLASS}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-9 w-9 rounded-md object-contain" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
          N
        </span>
      )}
    </a>
  );
}
