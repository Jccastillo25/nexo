# F1.0.1 — Cierre de acceso operativo PIN heredado (ejecutado 2026-09-07)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0.9 antes de la reestructuración de 2026-09-11. Contexto del hallazgo: [F1.0 — Auditoría real](2026-09-07-f1-0-auditoria-real.md) §0.6.

Aprobado por el usuario como hotfix inmediato, sin esperar a F1.3. Migración nueva `20260907151106_revoke_validar_acceso_operativo_public_execute` (aplicada primero vía `apply_migration`, archivo de Git escrito después con el mismo `version` que Supabase asignó — evita a propósito la divergencia de historial del 2026-09-05):

- `revoke execute on function public.validar_acceso_operativo(p_nombre_usuario text, p_pin text) from anon, authenticated;` — no toca `20260902000008` (migración histórica, sin editar).
- `rrhh.fn_validar_acceso_operativo` y su wrapper `public.validar_acceso_operativo` quedan explícitamente marcadas como **DEPRECADAS** vía `comment on function` — no se eliminaron, pendiente de una migración de limpieza aparte que también decida `rrhh.seguridad_accesos` y `rrhh.empleados.nombre_usuario`/`user_id`/`pin_bloqueado`/`intentos_fallidos`.
- Verificado post-aplicación con `has_function_privilege`: `anon`→`false`, `authenticated`→`false`, `service_role`→`true`, `postgres`→`true` (sin cambio, esperado).
- `get_advisors(security)` re-ejecutado: el WARN "Public Can Execute SECURITY DEFINER Function" para esta función ya no aparece.

D-06 queda **parcialmente cerrado**: el componente de seguridad inmediato (exposición a `anon`/`authenticated`) está resuelto; el refactor arquitectónico completo (eliminar el concepto de PIN-de-doble-propósito y construir identidad digital real) sigue pendiente de F1.3/Fase 2.
