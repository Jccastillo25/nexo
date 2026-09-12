# F1.1 — Separar Expediente General / Expediente Laboral (ejecutado 2026-09-07)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0.11 antes de la reestructuración de 2026-09-11.

Objetivo cumplido: "Crear empleado ≠ contratar empleado". `rrhh.fn_crear_empleado`/`public.crear_empleado` quedan con firma reducida (`nombre`, `apellido`, `documento_identidad`, `email`, `telefono` — sin `puesto`/`departamento`/`modalidad_contrato`/`salario_base`/`nombre_usuario`/`pin`). Devuelven `(empleado_id, codigo_empleado)`, sin PIN ni usuario.

Migraciones (aplicadas y verificadas):

- `20260907152301_f1_1_separar_expediente_general_laboral`: columnas laborales/credenciales de `rrhh.empleados` (`puesto`, `departamento`, `fecha_ingreso`, `fecha_baja`, `estado`, `pin_hash`, `nombre_usuario`, `pin_bloqueado`, `intentos_fallidos`, `user_id`) quedan `nullable` donde aplicaba y marcadas `DEPRECADAS` vía `comment on column` — no se eliminan todavía (columnas reales, pendientes de una migración de limpieza posterior tras F1.2). `estado` recibe un nuevo default `'sin_contrato'`. Firma anterior de `fn_crear_empleado`/`crear_empleado` (13 parámetros) eliminada — reemplazada, no editada in place (Postgres distingue funciones por firma).
- `20260907152500_f1_1_fix_empleados_estado_check`: corrección necesaria (el `CHECK` de `estado` no incluía `'sin_contrato'`) — detectada por una prueba de inserción/borrado **antes** de dar F1.1 por terminado, sin dejar ninguna fila real inválida.

Verificación ejecutada:

- Prueba de esquema (insert + delete inmediato, `rrhh.empleados` en 0 filas antes y después): un alta con solo datos generales queda con `puesto`/`departamento`/`pin_hash`/`nombre_usuario`/`user_id` en `null`, `estado = 'sin_contrato'`.
- `has_function_privilege`: `rrhh.fn_crear_empleado`/`public.crear_empleado` nuevos — `anon` sin acceso en ningún caso; `authenticated` solo en el wrapper público (mismo patrón que antes).
- **`rrhh.fn_registrar_marca_kiosko` (kiosko en producción) verificado intacto** — sigue exigiendo `estado = 'activo' and pin_hash is not null and not pin_bloqueado`; compatibilidad deliberada hasta que F1.3 reemplace esa validación por la credencial contractual.
- `generate_typescript_types` re-ejecutado: confirma la firma nueva de `crear_empleado` en `public`.

Frontend actualizado en el mismo cambio: `apps/rrhh/src/app/(app)/expedientes/nuevo/actions.ts`, `nuevo-empleado-form.tsx` y `page.tsx` (formulario reducido a datos generales, ya no piden compensación/PIN); `apps/rrhh/src/app/(app)/expedientes/page.tsx` (listado ya no filtra por `estado = 'activo'` ni muestra puesto/departamento/usuario — muestra todos los expedientes con una columna de estado de contrato placeholder); `apps/rrhh/src/app/(app)/dashboard/page.tsx` (KPI "Empleados activos" → "Expedientes", cuenta todos los registros). Tipos (`database.types.ts` de `apps/rrhh` y su espejo en `apps/crm`) actualizados a mano con las columnas deprecadas marcadas `@deprecated` y la firma nueva de `crear_empleado`.

**Consecuencia esperada y correcta**: entre F1.1 y F1.3, un empleado recién creado no puede marcar en el kiosko todavía (no tiene `pin_hash`, `estado` queda en `'sin_contrato'`) — el flujo completo (crear → contrato → activar → PIN → marcar) recién queda operable al cerrar F1.3, según el Definition of Done acordado.
