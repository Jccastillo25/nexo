import type { Metadata } from "next";
import Proximamente from "@/components/Proximamente";
import { EMPRESA } from "@/data/empresa";

export const metadata: Metadata = {
  title: `Quiénes somos · ${EMPRESA.nombre}`,
};

export default function QuienesSomosPage() {
  return <Proximamente titulo="Quiénes somos" />;
}
