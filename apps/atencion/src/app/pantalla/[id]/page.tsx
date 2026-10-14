import type { Metadata } from "next";
import PantallaPublica from "./pantalla-publica";

export const metadata: Metadata = {
  title: "Turnos",
  robots: { index: false, follow: false },
};

/**
 * Pantalla pública del televisor (sin login; el proxy la excluye). El id de
 * la pantalla es la credencial del dispositivo: la RPC anónima
 * public.atencion_pantalla_estado solo devuelve números, puestos y
 * configuración de entretenimiento, nunca datos del cliente.
 */
export default async function PantallaPage({ params }: PageProps<"/pantalla/[id]">) {
  const { id } = await params;
  return <PantallaPublica pantallaId={id} />;
}
