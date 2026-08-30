---
type: concept
updated: 2026-08-23
sources: [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
---

# Liquidaciones (comisión, gastos, anticipos)

Cierre financiero periódico del trabajo de un conductor: agrupa sus fletes desde el último
cierre, resta gastos operativos y anticipos, aplica su comisión, y produce un recibo formal.

## Quién dispara el cierre

El **conductor**, desde su dashboard ([[driver-app]]), tocando "Llenado Final de Tanque" — no es
necesariamente semanal en sentido estricto de calendario, es "todo lo acumulado desde el cierre
anterior", a discreción del conductor. Eso crea una fila en `settlements` con `status = 'draft'`;
un trigger de DB (`attach_loose_records_to_settlement`, ver [[settlements]]) engancha
automáticamente todos los viajes completados y anticipos que todavía no pertenecían a ninguna
liquidación — el conductor no elige cuáles, es todo-o-nada por diseño (evita que alguien
"esconda" un flete fuera de una liquidación).

## Quién completa el cierre

El **admin**, en `/admin/settlements/[id]`: ingresa `fuel_cost` (factura de combustible pagada
por la empresa) y `variable_expenses`, ve los anticipos ya enganchados (los registra él mismo en
cualquier momento desde el perfil del conductor — el conductor no ve ni gestiona sus propios
anticipos), y el sistema calcula en vivo:

```
Ingreso Bruto      = Σ trip_value de los viajes de la liquidación
Base Comisionable  = Ingreso Bruto − (fuel_cost + variable_expenses)
Comisión Neta      = Base Comisionable × (drivers.commission_percentage / 100)
Total a Pagar       = Comisión Neta − Σ driver_advances
```

## Sellado e inmutabilidad

"Sellar Liquidación" pasa `status` a `'completed'` y persiste el snapshot (`total_freight`,
`total_advances`, `final_payout`). A partir de ahí, un trigger `BEFORE UPDATE ON trips`
(`prevent_update_on_settled_trip`) rechaza cualquier intento de modificar un viaje que pertenezca
a esa liquidación — ni el admin ni el conductor pueden tocarlo, la garantía es de Postgres, no de
la UI (mismo principio que la inmutabilidad de `trip_events`/`trip_anomalies`, ver
[[gestion-por-excepcion]], pero implementado como trigger en vez de ausencia de policy `UPDATE`,
porque acá sí hace falta permitir `UPDATE` mientras está en `draft`).

## Recibo en PDF

`/api/admin/settlements/[id]/pdf` (Route Handler, `@react-pdf/renderer` — única dependencia
nueva agregada por este trabajo). Desglose de fletes, gastos, anticipos, total a pagar, y espacio
para firma del conductor. Solo se genera si la liquidación ya está `completed`.

## Alertas de datos faltantes

Un viaje puede llegar a `completed` sin `trip_value`/`invoice_number` (el conductor los deja
opcionales al cerrar el viaje, para no bloquearlo en campo si no tiene el dato a mano). El admin
recibe un aviso en tiempo real (Supabase Realtime sobre `trips`, ver [[trips]]) y puede
corregirlos directamente en `/admin/fleet-trips` (filtro "Pendiente de Datos Financieros" +
edición inline) — bloqueado en cuanto ese viaje entra en una liquidación sellada, por el mismo
trigger de arriba.

## Fuentes

- [[2026-08-23-panel-conductor-simplificado-y-liquidaciones]]
