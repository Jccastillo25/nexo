# 2026-10-24 — Flotilla: Entregas, E2 (esquema) aplicado en `nexo-core`

- **Pedido del usuario:** "Sigue con E2 (esquema de Entregas); el menú lo reviso yo después." Luego, "Sube todo a producción".
- **Estado anterior → nuevo:** E2 pendiente → **aplicado** en `nexo-core`, con el poscheque y los advisors revisados.
- **Commit:** se sube junto con E1 en la rama `deploy/2026-10-24-flotilla` (ver la entrada de despliegue en `IMPLEMENTATION_STATUS.md`).
- **Migraciones:** `20261024140400_flotilla_e2_esquema.sql` y `20261024140609_flotilla_e2_indices_fk.sql`, ambas aplicadas. La segunda la pidió el advisor de rendimiento: 34 FK compuestas sin índice cubriente; ahora son 0.
- **Diseño:** [plan 22 §21](../plan/22-flotilla-entregas.md).

## Qué crea

- El schema `flotilla`, cerrado: sin `USAGE` para `anon` ni `authenticated`, con RLS sin policies en todas las tablas y particiones.
- 21 tablas:
  - catálogos: zonas, bodegas, vehículos, conductores, motivos, reglas de envío y plantillas;
  - origen: `origenes` y `origen_lineas`;
  - órdenes: `ordenes`, `orden_lineas` y `validaciones`;
  - rutas: `recorridos`, `paradas` y `parada_lineas`;
  - seguimiento: `incidencias` y `evidencias`;
  - control: `operaciones`, más `eventos`, `movimientos` y `comunicaciones`, particionadas por mes y registradas en `core.tablas_particionadas`.
- Triggers que mantienen lo comprometido por línea de origen y los contadores por línea de orden.
- CHECK contra sobrecompromiso, doble despacho y resultados que no cuadran.
- Índices únicos parciales: una línea en un solo recorrido activo, y un vehículo o un conductor en un solo recorrido que sale.
- Transiciones de estado, hechos inmutables y versión optimista.
- Helpers: permiso, idempotencia, bitácora y libro de cantidades, más la vista `v_saldos_linea`.

## Pruebas

- **PGlite** (`pnpm test:flotilla:e2`, ya incluido en `test:db`), con código 0. Cubre 14 bloques:
  - clave de origen única;
  - integridad por empresa (producto, empleado y línea de origen de otra empresa);
  - escenario 18 (dos destinos sin superar 100 autorizadas; cancelar libera);
  - recorrido en preparación sin vehículo;
  - una línea en un solo recorrido activo y reservar más que el saldo;
  - escenario 5 (carga 100, acepta 80, rechaza 20, retorna 20; el siguiente intento no puede reservar 100);
  - escenario 6 (intento fallido no libera hasta conciliar; los intentos se conservan);
  - escenario 19 (corregir 80 → 70 exige documentar la diferencia);
  - transiciones de estado y versión;
  - un vehículo en dos recorridos listos para salir;
  - bitácora y libro inmutables;
  - idempotencia (clave nueva, en curso, mismo resultado, otro payload, otro actor y otra empresa);
  - permisos (sin permiso, con permiso y otra empresa);
  - particiones y RLS.
- **Mutación:** sin el CHECK `orden_lineas_sin_doble_despacho`, la prueba falla en "reservar más que el saldo".
- **Ensayo en `nexo-core`, transacción revertida.**
  - Se ejecutó la migración, con la empresa real y el usuario owner.
  - Prueba de humo: comprometer 110 de 100 se rechaza, comprometida queda en 60, reservar 60 actualiza la línea y la idempotencia acepta una clave nueva.
  - Resultado: 21 tablas, `authenticated` sin `USAGE`.
  - Después del rollback no existe el schema y no hay registros en `core.tablas_particionadas`.
- **Límite del ensayo:**
  - el ensayo remoto omitió los triggers de transición, la inmutabilidad de `comunicaciones`, `fn_exigir_alguno`, `fn_operacion_cerrar`, `fn_evento`, `fn_movimiento`, la vista, el bloque de revocaciones y el poscheque final, que sí corren completos en PGlite;
  - no hubo prueba con dos sesiones concurrentes.

## Aplicación (2026-10-24)

- `20261024140400`, poscheque dentro de la migración en verde: 21 tablas, 12 particiones, 0 tablas sin RLS, `authenticated` sin `USAGE` y 14 funciones.
- Advisor de rendimiento: 34 FK de flotilla sin índice cubriente.
  - Causa: los índices simples en `x_id` no cubren las FK `(x_id, company_id)`, y las tablas padre particionadas no tenían índices.
  - Corrección: `20261024140609`, probada antes en PGlite. Su poscheque y el advisor dan 0.
- Advisor de seguridad: solo `rls_enabled_no_policy` (INFO), esperado por diseño. Ninguna función de flotilla ejecutable por `anon` ni `authenticated`.

## Pendiente

- Prueba de concurrencia real con dos sesiones (escenario 4).
- E3: RPC de alta y validación de órdenes, cálculo de la fase visible, semillas de motivos y parámetros de prueba, y las pantallas.
