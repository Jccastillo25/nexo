import type { Metadata } from "next";
import PantallaPublica from "./pantalla-publica";

export const metadata: Metadata = {
  title: "Turnos",
  robots: { index: false, follow: false },
};

/**
 * Pantalla pública del televisor (sin login; el proxy la excluye). El id de
 * la pantalla es la credencial del dispositivo: la RPC anónima
 * public.atencion_pantalla_estado devuelve números, puestos, configuración de
 * entretenimiento y, solo de los turnos llamados, el nombre del cliente y del
 * agente (decisión 2026-10-15). Teléfono y factura nunca salen.
 */
export default async function PantallaPage({ params }: PageProps<"/pantalla/[id]">) {
  const { id } = await params;
  return <PantallaPublica pantallaId={id} />;
}
