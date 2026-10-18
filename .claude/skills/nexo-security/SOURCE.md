# Procedencia de nexo-security

Creada el 2026-10-17 por `skills-specialist`. No es copia de ninguna skill: es
una lista propia del repo, redactada en español, que toma **ideas** (sin texto
literal) de las fuentes oficiales de abajo y las ancla a reglas y migraciones
verificadas en el código.

## Fuentes evaluadas

| Fuente | Versión / commit | Licencia | Uso |
|---|---|---|---|
| Skill incorporada `security-review` de Claude Code; su versión pública: https://github.com/anthropics/claude-code-security-review (`.claude/commands/security-review.md`) | Commit no visible en la página consultada (repo con 30 commits, 2026-10-17) | MIT | Ideas: categorías (autorización/IDOR, exposición de datos, inyección, validación), hallazgo con archivo:línea + gravedad + recomendación, reportar solo lo nuevo del diff. **No instalada** |
| https://github.com/supabase/agent-skills — `skills/supabase-postgres-best-practices` (`references/security-privileges.md`, `security-rls-performance.md`) | v`1.1.1` (metadata del `SKILL.md`); commit no visible | MIT | Ideas: mínimo privilegio, `security definer` con chequeo de `auth.uid()` adentro y `revoke execute`. **No instalada** |
| https://supabase.com/docs/guides/database/functions | Consultada 2026-10-17 | Sin licencia declarada en la página | Solo hechos técnicos: `security definer` debe fijar `search_path`; `''` obliga a calificar nombres; revocar EXECUTE de `public` **y** de `anon` |
| https://supabase.com/docs/guides/database/database-advisors | Consultada 2026-10-17 | Sin licencia declarada en la página | Nombres de lints de seguridad para interpretar `get_advisors` |
| https://nextjs.org/docs/app/guides/data-security | `lastUpdated: 2026-10-06` | Docs del repo `vercel/next.js` (MIT) | Ideas: cada Server Action es un POST público y re-verifica authn/authz; validar toda entrada; devolver solo lo necesario; `server-only`; `NEXT_PUBLIC_` llega al cliente |

## Qué se inspeccionó

- `security-review.md`: frontmatter con `allowed-tools` (Bash para `git diff/status/log/show`, Read, Glob, Grep, LS, Task) y bloques `` !`git …` `` que se ejecutan al cargar. **Descartados**: esta skill no declara `allowed-tools` ni ejecuta comandos; el revisor obtiene el diff con sus propias herramientas.
- `security-review.md` también ordena lanzar subtareas paralelas para filtrar falsos positivos. **Descartado**: los subagentes de Nexo no lanzan otros (`Agent` deshabilitado, `CLAUDE.md`).
- `supabase/agent-skills`: README, `SKILL.md` de postgres-best-practices y dos referencias de seguridad. Sin scripts dentro de la skill, sin `allowed-tools`. El README propone instalar con `npx skills add …` / `claude plugin install …`: **no se instaló** (instalación externa sin necesidad demostrada; su contenido es mayormente rendimiento).
- Ninguna fuente contenía instrucciones dirigidas al agente para conceder permisos o ejecutar comandos fuera de lo descrito arriba.

## Adaptaciones al repo (cada una verificada en el código)

| Regla de la skill | Archivo verificado |
|---|---|
| `requirePermission`/`hasPermission`, fail-closed | `packages/permissions/index.ts:43-74` |
| Checklist v3.0, Paso Cero, dos capas | `docs/PERMISSIONS.md:54-90,109-120,136-155` |
| Código de 4 segmentos (ejemplo real) | `apps/productos/src/lib/permisos.ts:7-11` |
| Acción con `requirePermission` antes del efecto | `apps/productos/src/app/(app)/catalogo/actions.ts:10-20,31` |
| Patrón A (GRANT + RLS) y sus fixes | `supabase/migrations/20260830000010_fix_crm_schema_grants.sql`, `20260904000001_fix_rrhh_schema_grants.sql` |
| Patrón B (schema privado, todo por RPC) | `20261016214634_productos_esquema.sql:39,253-265,1287-1317`, `20261014224341_atencion_esquema.sql:80,254`, `docs/DATABASE.md:206` |
| Firma real de `core.fn_exigir_permiso(p_company_id uuid, p_code text) returns uuid` | `20261014203144_nexo_usuarios_roles_esquema.sql:221-237` |
| Revocar de `public` no quita `anon` | `20260830000012_fix_update_platform_settings_execute_grant.sql` |
| Avisos esperados del advisor | `docs/MIGRATION_LOG.md:204-208` |
| SQL dinámico con `format(%I)` | `20260902000002_partition_core_audit_log.sql:48-53` |
| SSO y redirección al panel | `apps/crm/src/lib/supabase/middleware.ts:43-55`, `apps/productos/src/app/login/actions.ts` |
| Validación de `next` (open redirect) | `apps/nexo/src/app/login/actions.ts:8-11,36` |
| `server-only` en cliente `service_role` | `apps/nexo/src/lib/supabase/admin.ts:1` |
| `companyId` desde el servidor | `apps/productos/src/lib/company.ts:5-13` |
| `.env*` ignorados, allowlist de turbo | `.gitignore:14-16`, `turbo.json:8-18` |
| Mensajes de RPC escritos para el usuario | `20261016214634_productos_esquema.sql:690`, `20261014203144…:231-233` |

Diferencias deliberadas con las fuentes:

- **Open redirect sí se reporta.** `security-review` lo excluye como falso positivo; Nexo ya tiene una defensa (`destinoSeguro`) y el `next` del login es una superficie real.
- **Errores**: en vez de "nunca `error.message`", se distingue entre mensajes de `raise exception` escritos para el usuario (permitidos) y errores crudos de Postgres/PostgREST (no). Motivo: el patrón actual del repo devuelve `error.message` en todas las acciones, y las RPC lo usan a propósito para mensajes en español.
- **Dos patrones de schema** (A expuesto con GRANT + RLS, B privado por RPC). La guía genérica solo cubre el A; aplicar "GRANT a authenticated" al patrón B sería un retroceso.
- Gravedad en cuatro niveles (crítica/alta/media/baja) en lugar de los tres de `security-review`, alineada con el formato del `reviewer`.

## Limitaciones conocidas

- Las consultas de `consultas-remotas.md` **no se ejecutaron** contra `nexo-core` al crear la skill (el especialista no tiene MCP). En particular, la forma exacta de `search_path=""` en `proconfig` no está verificada: la consulta 2.2 lo advierte.
- La lista no se probó todavía sobre un diff real. No hay evaluación comparativa contra `security-review`.
- No cubre CSP, cabeceras HTTP, rate limiting ni dependencias vulnerables (fuera del encargo).
