// Estado vacio universal — reemplaza los "todavia no hay X"/"pendiente de Y"
// que cada pantalla escribia con su propio <p> suelto. Se usa tanto para
// "sin datos" como para "funcionalidad pendiente" (ej. pestañas de perfil
// de empleado que requieren un modelo de datos aun no aprobado — ver
// docs/RRHH_MVP.md §14). Regla obligatoria (CLAUDE.md): nunca inventar un
// numero/dato aca, este componente es justamente la alternativa explicita a
// eso.
export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center">
      {icon && <span className="text-neutral-300">{icon}</span>}
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description && <p className="max-w-sm text-xs text-neutral-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
