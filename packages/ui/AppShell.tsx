// Layout de dos columnas (ShellBar arriba + Sidebar flotante + contenido)
// con fondo --nexo-bg — ver docs/planning/ARQUITECTURA_MVP_ESCALABLE.md
// §4.3. Antes de este componente, cada apps/<modulo>/(app)/layout.tsx
// armaba este mismo grid a mano (ver apps/crm/src/app/(app)/layout.tsx,
// que se deja intacto — CRM sigue en paleta clara, migrarlo es aparte).
//
// No renderiza <ShellBar>/<Sidebar> directo: los recibe como children ya
// armados (`shellBar`, `sidebar`) porque cada modulo envuelve ShellBar en
// su propio Header (con su titulo/backHref/onSignOut) y Sidebar en su
// propio wrapper cliente (con sus items y el pathname activo, via
// usePathname — ver apps/crm/src/components/AppSidebar.tsx). AppShell no
// conoce esos detalles, solo arma el esqueleto.
//
// Server Component: no tiene estado propio, se puede usar directo desde
// el layout autenticado del modulo (que a su vez es donde vive el chequeo
// de permisos, ver docs/PERMISSIONS.md).

export interface AppShellProps {
  shellBar: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ shellBar, sidebar, children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--nexo-bg)] text-[var(--nexo-shell-fg)]">
      {shellBar}
      {/* Sidebar es un dock flotante (position: fixed), no ocupa espacio
          en el flujo — este pl-24 le deja el margen para que el contenido
          no quede tapado por el dock colapsado (w-16 + left-4), mismo
          patron que apps/crm. */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 pl-24 sm:px-6 sm:pl-28">
        {sidebar}
        {children}
      </main>
    </div>
  );
}
