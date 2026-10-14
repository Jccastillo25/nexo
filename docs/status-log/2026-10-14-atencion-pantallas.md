# 2026-10-14 — Pantallas de Sucursales y del módulo Atención

## Contexto

Tercer paso del módulo Atención, sobre la base de datos ya aplicada
([esquema](2026-10-14-atencion-esquema.md)). Pedido del usuario: primero
Sucursales en Configuración y su asignación en Usuarios, después la app.

## Estado anterior → estado nuevo

- Sin pantallas → **implementado, sin probar con sesión real, app inactiva y
  sin proyecto Vercel**.

## Entregado

`apps/nexo`:
- `/configuracion/sucursales`: lista, alta y edición (y la tarjeta
  "Configuración" del Launcher también lleva aquí con `sucursales.ver`).
- Formulario de usuario: casillas de sucursales al crear/editar
  (`admin_asignar_sucursales`); oculto si no se pueden ver sucursales.
- Auditoría: etiquetas de las nuevas acciones.
- Rewrite `/atencion` → `ATENCION_APP_URL` (solo si existe) y la variable en
  `turbo.json`.

`apps/atencion` (nueva, a partir del esqueleto de `apps/agencia`):
- `/dashboard`: "Iniciar atención" (pregunta sucursal si hay varias y
  recepción/puesto si el rol permite ambas; el servidor asigna el primer
  puesto libre) o atención abierta con "Ir a…" / "Cerrar atención"; KPIs del
  día (en espera, atendidos, ausentes, puestos ocupados).
- `/atender`: **Recepción** (nombre, teléfono, factura → número grande;
  fila con anular) o **Puesto** (llamar siguiente, repetir, atendido, no se
  presentó, llamar fuera de orden). Refresco cada 4 s.
- `/configuracion`: puestos (orden = prioridad de asignación) y pantallas
  (enlace para el TV, lista/video de YouTube) por sucursal.
- `/pantalla/<id>`: TV sin login (excluida del proxy). 30 % turnos (llamado
  actual grande, otros puestos, próximos) y 70 % YouTube. Cada llamado nuevo
  o repetido: sonido, voz ("Turno 7, Puesto 2"), destaque 8 s y volumen del
  video bajado. Botón "Activar sonido y pantalla completa" (los navegadores
  exigen un toque para el audio). Tema oscuro, como el kiosco.
- Server Actions con `requirePermission` antes de cada RPC.

## Pruebas ejecutadas

- `pnpm install` (lockfile: importer nuevo + reacomodo de resoluciones de
  eslint sin cambios de versión).
- `next build` + `eslint` limpios en `nexo-atencion` y `nexo-panel`.

## Pendiente

1. ~~Crear el proyecto Vercel `nexo-atencion`~~ — creado 2026-10-14 con
   aprobación del usuario (Root Directory `apps/atencion`, repo conectado;
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXO_COMPANY_ID` en Production+Preview; `NEXO_PANEL_URL` solo Preview de
   esta rama). `ATENCION_APP_URL` en `nexocore`: solo Preview de
   `feat/atencion-paso-cero`. **Falta la de Production** (dominio de
   producción de `nexo-atencion`), a configurar al fusionar a `main`.
2. Activar la app (`core.apps.active` + `core.company_apps`).
3. Prueba real: sucursal, puestos, roles desde plantillas, usuarios con
   sucursal, recepción + 2 agentes + TV.
4. Pendientes de UI: liberar el puesto de otro usuario (la RPC existe), reportes.

## Commit

Rama `feat/atencion-paso-cero` (sin push).
