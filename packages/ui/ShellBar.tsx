// Shell bar persistente, inspirada en el "shell bar" de SAP Fiori (ver
// docs/planning/DISENO_UX_UI.md): barra oscura siempre visible, marca a la
// izquierda, usuario + accion de salir a la derecha. Chrome neutral de la
// suite — cada modulo mantiene su propia identidad visual puertas adentro.

export interface ShellBarProps {
  title: string;
  userEmail?: string | null;
  /** Server action (form action) para cerrar sesion. */
  onSignOut?: () => void | Promise<void>;
}

export function ShellBar({ title, userEmail, onSignOut }: ShellBarProps) {
  return (
    <div className="flex items-center justify-between bg-neutral-900 px-6 py-3 text-neutral-50">
      <span className="text-sm font-semibold tracking-tight">{title}</span>
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
