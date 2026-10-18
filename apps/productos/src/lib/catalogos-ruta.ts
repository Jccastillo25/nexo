// Catálogos de configuración con ruta propia (/configuracion/<catalogo>).
// Vive fuera de paneles.tsx porque ese archivo es "use client": un valor
// exportado desde un módulo de cliente llega al servidor como referencia de
// cliente, no como el arreglo (error real del 2026-10-17: "includes is not a
// function" en /configuracion/marcas).
export const CATALOGOS_RUTA = ["marcas", "unidades", "proveedores", "caracteristicas", "cuentas"] as const;
export type CatalogoRuta = (typeof CATALOGOS_RUTA)[number];
