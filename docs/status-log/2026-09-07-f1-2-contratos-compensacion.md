# F1.2 — `rrhh.contratos` + compensación contractual (ejecutado 2026-09-07)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0.12 antes de la reestructuración de 2026-09-11.

Migración `20260907153604_f1_2_rrhh_contratos`, aplicada y verificada:

- **`rrhh.contratos`** (Expediente Laboral): `estado` `borrador → activo → finalizado`, sin reabrir; `puesto`/`departamento`/`modalidad_contrato`/`fecha_inicio` congelados fuera de `borrador`. Un solo contrato `activo` por empleado (unique index parcial). RLS: `ver`/`crear`/`editar` (editar solo en `borrador`); **sin policy de `DELETE`** (no se borra físicamente). Activar/finalizar son transiciones exclusivas de sus RPC — no hay policy de UPDATE que permita cambiar `estado` directo.
- **Trigger `trg_validar_transicion_contrato`** (defensa en profundidad, independiente de RLS): rechaza transiciones inválidas e ediciones de datos base fuera de `borrador`, sin importar qué función `SECURITY DEFINER` intente el `UPDATE`.
- **`rrhh.contrato_compensacion`** (1:1 con el contrato, no con el empleado — D-03): reutiliza los permisos existentes `rrhh.expedientes.compensacion.ver`/`.editar` (re-scopeados semánticamente, sin crear un permiso nuevo — confirmado en `core.app_role_permissions` que solo `admin` tiene `.editar` antes de escribir la migración). Sin policy de escritura directa, solo vía RPC.
- **RPC**: `rrhh.fn_crear_contrato`/`fn_editar_contrato`/`fn_activar_contrato`/`fn_finalizar_contrato` (+ wrappers `public.*`, `authenticated`-only, sin `anon`). `fn_activar_contrato`/`fn_finalizar_contrato` son **solo transición de estado por ahora** — F1.3 las reemplaza (`create or replace`) para generar/revocar el PIN.

Verificación ejecutada (inserción/transición/borrado de prueba, 0 filas antes y después):

- Transición inválida `borrador → finalizado` directa: **rechazada** por el trigger.
- Activación `borrador → activo`: aceptada.
- Edición de `puesto` estando `activo`: **rechazada** por el trigger.
- Segundo contrato `activo` para el mismo empleado: **rechazado** por el unique index parcial.
- Finalización `activo → finalizado`: aceptada; reapertura `finalizado → activo`: **rechazada** por el trigger.
- `pg_policies`: 3 policies en `contratos` (SELECT/INSERT/UPDATE, sin DELETE), 1 en `contrato_compensacion` (solo SELECT).
- `has_function_privilege`: `anon` sin acceso a ninguna función nueva; `authenticated` solo en los 4 wrappers públicos; las `rrhh.fn_*` internas solo `postgres`.
- `get_advisors(security)`: los 4 wrappers nuevos aparecen como "authenticated puede ejecutar SECURITY DEFINER" — **esperado**, mismo patrón ya aceptado para `crear_empleado`/`set_pin_empleado`. Sin exposición nueva a `anon`.

Frontend nuevo: `/rrhh/expedientes/[id]` (ficha del empleado — Expediente General + Expediente Laboral), con `contratos-panel.tsx` (crear/editar borrador, activar, finalizar) y `actions.ts` correspondientes. El listado (`/rrhh/expedientes`) ahora enlaza cada fila a su ficha y muestra si tiene contrato activo real (ya no la columna deprecada `estado`).

**No verificado en el navegador** — el entorno de esta sesión sigue con el `EPERM` en `node_modules/.pnpm/.../next`/`typescript` ya documentado (2026-09-05), reconfirmado hoy con `next dev` y `tsc --noEmit`: mismo error, mismo entorno, no relacionado con este cambio. Sustituido por revisión estática cuidadosa del código + verificación exhaustiva de esquema/RPC/RLS contra el remoto real.
