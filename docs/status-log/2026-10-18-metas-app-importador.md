# 2026-10-18 — Metas de ventas: `apps/metas` + importador del Excel en bruto

- **Subfase / entregable:** app `apps/metas` (zona `/metas`, puerto 3006) con sus seis pantallas y un lector del Excel del ERP pensado para el archivo **sin depurar** que el usuario va a enviar.
- **Estado anterior → nuevo:** esquema y RPC aplicados, sin app → app implementada en local, compila (typecheck/lint/test/build), **sin activar**, **sin sesión real**, **sin datos importados**, sin commit ni proyecto Vercel.
- **Pedido del usuario:** "Prepara todo para luego enviarte el Excel con toda la información sin depurar ya que trae bastante".
- **Migraciones:** ninguna nueva (usa `20261018133816` y `20261018135152`).
- **Flujo:** coordinador (lector, infraestructura, rewrite, icono) → `ux-planner` (especificación) → `ui-frontend` (pantallas) → `reviewer` (ver abajo).

## Lector del Excel (`apps/metas/src/lib/importacion.ts`)

Funciones puras, sin imports, compartidas por la pantalla Importar (navegador) y
`apps/metas/scripts/validar-excel.mjs` (Node, sin tocar la base).

- Recorre **todas las hojas**; reconoce las de facturas buscando el encabezado en las primeras 40 filas con sinónimos (Fecha / N.º, No. o Número de factura / Cliente / Anulada o Estado / Total C$ / Total US$ / Total + Moneda / Tipo de cambio / Vendedor, Agente o Ejecutivo). Explica por qué ignora las demás ("Parece de compras", "No tiene una tabla de facturas (faltan: …)").
- Ignora filas vacías, títulos, encabezados repetidos y filas de totales (con la palabra Total/Subtotal o solo montos), cada una con su motivo.
- Normaliza fechas (Date, serie de Excel, `dd/mm/aaaa`, `aaaa-mm-dd`, con hora), montos (`C$ 1,605.00`, `(100)`, `1.605,50`), anuladas (Sí/No/X/1/Anulada) y números de factura.
- Calcula US$ (o C$) con el tipo de cambio de la fila o el por defecto 36.6243 cuando falta una columna; anuladas sin total se guardan en 0.
- Deduplica por número entre hojas (igual → una vez; distinta → la última) y resume por año y por vendedor.

Pruebas: 9 casos con `node --test` (`pnpm test:metas`, también en `pnpm verify` y CI).

**Con el Excel actual del usuario** (`PPTO 2026 JCastillo.xlsx`, validador en Node):
4 hojas reconocidas (2023–2026), 3 ignoradas (Dashboard, compras, PPTO +32%),
47 301 facturas, leídas y analizadas en ~2.4 s. Totales sin anuladas por año
idénticos al Dashboard del Excel: 2023 7 642 facturas / C$ 77,716,266.33;
2024 13 223; 2025 12 173; 2026 13 604 / C$ 145,543,853.82. Tipo de cambio
detectado 36.6243. 11 vendedores.

## Rendimiento de la RPC (medido en `nexo-core`, transacción revertida)

1000 facturas sintéticas en 45 meses: 0.9 s nuevas, 0.5 s repetidas. Lote fijado
en 1000 (~250 KB por Server Action, límite configurado 4 MB). ~47 lotes para el
histórico completo.

## Pantallas (`ui-frontend`)

Dashboard (Mi avance / Equipo con pestañas), Facturas (todas o mis facturas),
Importar del ERP (análisis local, progreso por lote, detener, reintentar,
`beforeunload`, resumen y descarga de errores), Metas por vendedor
(`/por-vendedor`), Presupuesto anual y Vendedores y usuarios. Decisiones del
coordinador sobre la especificación en el [plan 15](../plan/15-metas-ventas.md#5-pantallas).

## Infraestructura

- `apps/nexo/next.config.ts`: rewrite `/metas` → `METAS_APP_URL` (sin variable, sin rewrite); `turbo.json` con `METAS_APP_URL`; `.env.local` del panel con `http://localhost:3006`.
- `packages/ui/app-icons.tsx`: icono `target` (diana) para el Launcher.
- `scripts/lint-apps.mjs`: `nexo-metas` en el gate de lint. `.claude/launch.json`: servidor `metas`.
- `pnpm-lock.yaml` actualizado con `apps/metas` (mismas versiones fijadas que Productos).

## Revisión independiente (`reviewer`)

Sin críticos ni altos. Corregidos:

- **M1** (lector): subtotales con fecha y vendedor ("Total", "Subtotal 001" en el número o "Total …" en el vendedor) se importaban como facturas → ahora son `resumen`. La columna Cliente no se mira (un cliente puede llamarse "Totales S.A.").
- **M2** (vendedores): un vínculo con un usuario inactivo quedaba invisible y trabado → opción "(inactivo)" visible y desvinculable.
- **M3**: las pruebas del lector no corrían en CI → `pnpm test:metas` en `pnpm verify` y fila `test-metas-importacion` en `ci.yml` (no obligatoria en la protección de `main`).
- **B1** número de factura en mayúsculas en las dos capas; **B2** `C$ -100` y punto de miles (`1.605`); encabezado "Factura No."; **B3** aviso de no salir durante la importación; **B4** importación vencida termina en vez de reintentar en bucle; **B5** % truncado (nunca "100 %" sin "Cumplida"); **B6** meta en 0 distinta de meta sin definir; **B7** "Ver todas mis facturas" filtra por el propio vendedor; **B8** crecimiento a 2 decimales; **B9** "Facturas importadas hasta" en Facturas (gerente); **B10** barra con `transform`; **B11** revalidación una sola vez al terminar; higiene de comentarios y del validador.
- Quedan: B9 en Mis facturas / Metas por vendedor / Presupuesto (sus RPC no devuelven la fecha); B12 dos importaciones simultáneas creando el mismo vendedor (supuesto de un solo importador); `ConfirmDialog` de `@nexo/ui` sin manejo de foco ni Esc (deuda previa de `main`).

## Pruebas

| Prueba | Resultado |
|---|---|
| `pnpm --filter nexo-metas typecheck` | ✅ |
| `pnpm --filter nexo-metas lint` | ✅ sin warnings |
| `pnpm --filter nexo-metas test` | ✅ 9/9 |
| `pnpm lint:plan` | ✅ `nexo-metas` en el gate |
| `pnpm --filter nexo-panel typecheck` / `lint` (rewrite e icono) | ✅ |
| `pnpm --filter nexo-metas build` | ✅ 8 rutas |
| Navegador local sin sesión | `/metas/dashboard` redirige a `localhost:3000/login?next=/metas/dashboard` (SSO) |

## No verificado

- Recorrido con sesión real: la app está inactiva para la empresa (`has_permission` exige `company_apps.enabled`) y no se ingresan contraseñas.
- Importación real del Excel contra `nexo-core`.
- Vista móvil y lector de pantalla reales.

## Activación (mismo día)

Con la aprobación del usuario ("actívala"): migración `20261018174647_metas_activar` aplicada. `core.apps.active = true` y `company_apps.enabled = true`; el owner tiene `metas.ver_modulo`. La tarjeta aparece en el Launcher (también en producción, donde no abre hasta el deploy).

## Pendiente

1. ~~Activar `metas` para la empresa~~ (hecho, `20261018174647`). Recorrerla con sesión real en local.
2. Recibir el Excel en bruto, correr `validar-excel`, revisar el informe con el usuario e importar.
3. Cargar presupuesto 2026, generar metas, vincular vendedores con usuarios, asignar plantillas a roles.
4. Commit/PR, proyecto Vercel `nexo-metas`, `METAS_APP_URL` en `nexocore`.
