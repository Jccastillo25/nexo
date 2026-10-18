// Tipos de marca que la persona elige con botones después del PIN (P4c,
// 2026-10-17). Módulo común de la Server Action y del cliente: un archivo
// "use server" solo puede exportar funciones async, así que la lista vive aquí.

export type Accion = "entrada" | "inicio_descanso" | "fin_descanso" | "salida";

/** Orden fijo en que se muestran los botones. */
export const ACCIONES: readonly Accion[] = ["entrada", "inicio_descanso", "fin_descanso", "salida"];

export function esAccion(value: unknown): value is Accion {
  return typeof value === "string" && (ACCIONES as readonly string[]).includes(value);
}

/** Texto del botón. */
export const BOTON_ACCION: Record<Accion, string> = {
  entrada: "Registrar entrada",
  inicio_descanso: "Iniciar descanso",
  fin_descanso: "Terminar descanso",
  salida: "Registrar salida",
};

/** Texto del resultado (la hora del servidor se agrega en la pantalla). */
export const RESULTADO_ACCION: Record<Accion, string> = {
  entrada: "Entrada registrada",
  inicio_descanso: "Inicio de descanso registrado",
  fin_descanso: "Fin de descanso registrado",
  salida: "Salida registrada",
};
