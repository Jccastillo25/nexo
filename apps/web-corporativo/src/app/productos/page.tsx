import type { Metadata } from "next";
import Proximamente from "@/components/Proximamente";
import { EMPRESA } from "@/data/empresa";

export const metadata: Metadata = {
  title: `Productos · ${EMPRESA.nombre}`,
};

export default function ProductosPage() {
  return <Proximamente titulo="Productos" />;
}
