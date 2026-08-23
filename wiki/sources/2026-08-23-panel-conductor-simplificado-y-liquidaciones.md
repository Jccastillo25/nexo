---
type: source
date: 2026-08-23
kind: conversation
ref: migraciones supabase/migrations/0016 a 0020
---

El usuario pidió reevaluar la lógica del panel del conductor ("siento que son muchos pasos...
necesitamos hacerlo lo más fácil y simple posible"). Se propuso fusionar los 4 taps del ciclo de
viaje en menos pasos; el usuario respondió pegando un documento completo de especificación
("Documento de Arquitectura y Flujo: Operación y Liquidaciones") que confirma esa dirección y la
extiende con una capa financiera nueva: Dashboard Central del conductor (vehículo asignado,
resumen de ciclo, "Llenado Final de Tanque"), campos `invoice_number`/`trip_value` opcionales en
el cierre de viaje, alertas en tiempo real al admin cuando falten esos datos, y un módulo
completo de Liquidaciones (comisión por conductor, gastos operativos, anticipos, sellado
inmutable, recibo en PDF).

Se implementó vía `EnterPlanMode` (plan aprobado sin cambios) tras explorar el código existente.
Dos decisiones de producto que el documento dejaba abiertas se resolvieron con la opción
recomendada (el usuario no respondió las preguntas de aclaración, así que se documentaron como
supuestos en el plan en vez de bloquear):

1. **Vehículo "asignado"**: asignación explícita del admin (`drivers.current_vehicle_id`), no
   memoria automática del último vehículo usado — porque el documento dice literalmente
   "asignado", que implica control del admin.
2. **Corrección de datos financieros faltantes**: el admin puede editar `invoice_number`/
   `trip_value` directamente desde `/admin/fleet-trips` (no solo ver la alerta) — bloqueado
   después por un trigger de DB en cuanto el viaje entra en una liquidación sellada.

Migraciones aplicadas directamente sobre el proyecto Supabase de producción vía MCP
(`apply_migration`), en orden: `0016` (vehículo asignado), `0017` (campos financieros de
`trips` + `commission_percentage` de `drivers`), `0018` (tablas `settlements`/`driver_advances`,
triggers de inmutabilidad y de enganche automático), `0019` (Realtime sobre `trips`), `0020`
(hardening: revoca EXECUTE público de los dos triggers nuevos, mismo patrón que la `0003`).
Verificado con `get_advisors` tras cada tramo. Se agregó `@react-pdf/renderer` como única
dependencia nueva del proyecto, para generar el recibo de liquidación en PDF desde un Route
Handler. `npm run build`, `tsc --noEmit` y `eslint` quedaron limpios; no se pudo probar el flujo
autenticado de punta a punta (conductor/admin) por falta de credenciales de prueba en el
entorno — el usuario decidió pushear a producción de todas formas dado que las migraciones ya
estaban aplicadas (aditivas, sin romper el código anterior) y el build/lint pasaban limpios.

Commit: `b1da575` ("Simplifica panel de conductor y agrega modulo de Liquidaciones"), pusheado a
`origin/master`.

Páginas que actualizó o creó: [[driver-app]], [[panel-admin]], [[trips]], [[drivers]],
[[liquidaciones]] (nueva), [[settlements]] (nueva), [[roadmap]].
