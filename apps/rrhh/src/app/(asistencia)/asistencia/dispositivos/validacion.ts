// Validación compartida por el formulario (cliente) y las Server Actions
// (servidor) de Dispositivos. Vive en un módulo sin "use client" ni
// "use server" para poder importarse desde ambos lados.

export const NOMBRE_MAX = 80;
export const UBICACION_MAX = 120;

export interface DispositivoInput {
  nombre: string;
  ubicacion: string;
}

export interface DispositivoValido {
  nombre: string;
  ubicacion: string | null;
}

export type ValidacionDispositivo =
  | { ok: true; valor: DispositivoValido }
  | { ok: false; campo: "nombre" | "ubicacion"; message: string };

export function validarDispositivo(input: unknown): ValidacionDispositivo {
  const datos = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  const ubicacionCruda = datos.ubicacion;

  if (!nombre) {
    return { ok: false, campo: "nombre", message: "Escribe el nombre del dispositivo." };
  }
  if (nombre.length > NOMBRE_MAX) {
    return { ok: false, campo: "nombre", message: `El nombre admite hasta ${NOMBRE_MAX} caracteres.` };
  }
  if (ubicacionCruda !== undefined && ubicacionCruda !== null && typeof ubicacionCruda !== "string") {
    return { ok: false, campo: "ubicacion", message: "Revisa la ubicación." };
  }
  const ubicacion = typeof ubicacionCruda === "string" ? ubicacionCruda.trim() : "";
  if (ubicacion.length > UBICACION_MAX) {
    return { ok: false, campo: "ubicacion", message: `La ubicación admite hasta ${UBICACION_MAX} caracteres.` };
  }

  return { ok: true, valor: { nombre, ubicacion: ubicacion || null } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esIdValido(id: unknown): id is string {
  return typeof id === "string" && UUID.test(id);
}
