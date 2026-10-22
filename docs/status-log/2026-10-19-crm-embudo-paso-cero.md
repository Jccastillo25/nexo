# 2026-10-19 — CRM: Paso Cero del embudo comercial (Leads, Oportunidades, Actividades, Cotizaciones)

- **Estado:** no existía → matriz **aplicada** en `nexo-core`. Sin tablas, sin pantallas, sin commit.
- **Migración:** [`20261019152215_crm_embudo_paso_cero.sql`](../../supabase/migrations/20261019152215_crm_embudo_paso_cero.sql). Se escribió como `20261019000000_…` y se renombró a la versión remota.
- **Aprobación:** del usuario, 2026-10-19: "Sí, apruebo la matriz y las plantillas del embudo comercial".
- **Diseño:** [plan/16-crm-embudo-comercial.md](../plan/16-crm-embudo-comercial.md). La referencia funcional es NextCRM (MIT): se toma su modelo, no su código.

## Contexto

El usuario pidió buscar en GitHub un ERP/CRM de código abierto. Se compararon cuatro:

- Twenty (AGPL).
- Carbon (AGPL con piezas comerciales, Postgres con RLS).
- IDURAR (AGPL, MongoDB).
- NextCRM (MIT, Next.js + Postgres).

Ninguno encaja directo con Nexo: cada uno trae su propio login, base de datos y estructura de app. Se decidió seguir en Nexo y usar NextCRM como guía para las piezas del CRM que faltaban, que el menú ya mostraba como "Pronto".

## Verificación remota previa

- Catálogo `crm`: 13 códigos, ninguno del embudo.
- Plantillas: vendedor 4, gerente 10, administrador 13.
- Schema `crm`: solo la tabla `clientes`.

## Qué se aplicó

21 códigos de 4 segmentos:

- `crm.ventas.lead.{ver,crear,editar,convertir,eliminar}`.
- `crm.ventas.oportunidad.{ver,crear,editar,eliminar}`.
- `crm.ventas.actividad.{ver,crear,editar,eliminar}`.
- `crm.ventas.cotizacion.{ver,crear,editar,aprobar,anular}`.
- `crm.ventas.equipo.ver`: alcance de todo el equipo. Sin él, cada quien opera solo lo que tiene asignado.
- `crm.ventas.asignacion.gestionar`.
- `crm.configuracion.embudo.gestionar`.

Plantillas ampliadas:

- **Vendedor 17:** ver, crear y editar de los cuatro recursos, más `lead.convertir`.
- **Gerente de ventas 27:** todo menos `lead.eliminar`, `oportunidad.eliminar`, `actividad.eliminar` y `embudo.gestionar`.
- **Administrador de ventas 34:** todo.

## Pruebas

1. **Ensayo en transacción revertida.** El precheck pasó y los conteos salieron 34 / 17 / 27 / 34. El primer borrador decía que el gerente tendría 26 porque contaba un `cotizacion.eliminar` que no existe; se corrigió antes de aplicar. Después del ensayo, el catálogo seguía con 13 códigos.
2. **Aplicada con precheck y postcheck dentro de la migración.**
3. **Postcheck remoto:**
   - Versión `20261019152215`.
   - Catálogo `crm`: 34 códigos.
   - Plantillas: 17 / 27 / 34.
   - 0 roles de empresa con los códigos nuevos: nadie los recibió automáticamente.

## Pendiente

- Especificación de pantallas: hecha, en [plan/16a](../plan/16a-crm-embudo-especificacion-ux.md). Faltan las respuestas del usuario a P1–P7 (precio digitado, IVA, PDF, búsqueda de productos, tipo de cambio, validez, autoaprobación) y confirmar los datos iniciales (S6).
- Esquema `crm.*`:
  - Tablas: etapas, orígenes, motivos de pérdida, leads y oportunidades.
  - Particionadas por mes: actividades, y cotizaciones con sus líneas.
  - RPC `public.crm_*`.
- UI en `apps/crm`, revisión, pruebas y commit.
- Asignar los permisos a roles de empresa, cuando el usuario lo decida.
