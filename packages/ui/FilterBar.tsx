"use client";

// Contenedor de filtros de un listado (ej. fecha/empleado/estado en la
// futura vista de asistencia de F1.5, o busqueda/estado en expedientes).
// Deliberadamente generico: recibe los controles como children (inputs/
// selects que arma la pagina) en vez de imponer un set fijo de filtros —
// cada listado tiene campos distintos. Dentro, usar <Field>/<Input>/<Select>.
export interface FilterBarProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export function FilterBar({ children, onReset }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      {children}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto rounded-sm text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
