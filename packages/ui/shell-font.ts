// Tipografia del chrome compartido (ShellBar, Sidebar) — ver
// docs/planning/NORMA_DISENO_UNIVERSAL.md §1.3. Se carga ACA, no en cada
// app consumidora, a proposito: el CRM redefine la utility `font-sans` de
// Tailwind a su propia fuente de marca (Work Sans, ver
// apps/crm/src/app/globals.css `@theme inline`), asi que si ShellBar
// dependiera de heredar `font-sans` del body terminaria renderizando en la
// tipografia del modulo que lo monta — exactamente la fragmentacion que
// esta norma existe para evitar. Cargando Inter directo con next/font y
// aplicando su className al elemento raiz de cada componente, el chrome se
// ve igual sin importar que fuente eligio el contenido de adentro.
import { Inter } from "next/font/google";

export const shellFont = Inter({ subsets: ["latin"], display: "swap" });
