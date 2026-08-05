// Catálogo de productos — lista simple en código (sin base de datos).
// PENDIENTE: reemplazar con las categorías/productos reales de Materiales
// Jcastillo. Estructura lista para llenar: cada categoría es un título +
// lista de items (nombre y, opcional, descripción/imagen en /public).

export type Producto = {
  nombre: string;
  descripcion?: string;
  imagen?: string; // ruta dentro de /public, ej. "/productos/cemento.jpg"
};

export type CategoriaProductos = {
  slug: string;
  titulo: string;
  productos: Producto[];
};

export const CATEGORIAS: CategoriaProductos[] = [
  // PENDIENTE: agregar categorías reales, ej.:
  // {
  //   slug: "cemento-y-agregados",
  //   titulo: "Cemento y agregados",
  //   productos: [
  //     { nombre: "Cemento Canal" },
  //     { nombre: "Arena" },
  //   ],
  // },
];
