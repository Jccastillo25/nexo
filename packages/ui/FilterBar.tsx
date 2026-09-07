"use client";

// Contenedor de filtros de un listado (ej. fecha/empleado/estado en la
// futura vista de asistencia de F1.5, o busqueda/estado en expedientes).
// Deliberadamente generico: recibe los controles como children (inputs/
// selects que arma la pagina) en vez de imponer un set fijo de filtros —
// cada listado tiene campos distintos.
export interface FilterBarProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export function FilterBar({ children, onReset }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      {children}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
