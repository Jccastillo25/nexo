# Productos (`apps/productos`)

Catálogo maestro de productos de la empresa (Nexo es el maestro; el ERP se
alimenta con la exportación en su formato). Diseño y decisiones:
[`docs/plan/14-productos.md`](../../docs/plan/14-productos.md).

- Zona `/productos` de Multi-Zones (`basePath`), login único en `apps/nexo`.
- Toda la lógica vive en las RPC `public.productos_*` de `nexo-core`: ID
  inmutable, código automático `CCTTKK-NNN` editable, clasificación
  Clase › Tipo › Categoría, importación todo-o-nada y costo oculto sin permiso.
- La importación lee el Excel del ERP en el navegador y manda las filas como
  JSON a `productos_importar` (vista previa primero, después confirmar).

Desarrollo local (puerto 3005):

```bash
pnpm --filter nexo-productos dev:zone
```

Variables: ver `.env.local.example`. En Vercel: proyecto propio con Root
Directory `apps/productos`; en `nexocore`, `PRODUCTOS_APP_URL` apunta a su deploy.
