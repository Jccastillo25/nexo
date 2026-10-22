# Procedencia de nexo-planilla-motor

| Campo | Valor |
|---|---|
| Tipo | Creación propia (2026-10-21), a pedido del coordinador para PL2–PL7 de Planilla |
| Base principal | `docs/plan/20-planilla.md` §6, §7, §8, §10; `docs/PERMISSIONS.md` (Planilla — Paso Cero y separación de funciones); `docs/RRHH_MVP.md` §8 y §14 |
| Patrones del repo verificados | `supabase/migrations/20260902000005_rrhh_permissions_and_roles.sql`, `20260902000006_rrhh_schema_and_tables.sql`, `20260902000008_rrhh_nicaragua_and_contracts.sql`, `20260904000001_fix_rrhh_schema_grants.sql`, `20260905000003_rrhh_rls_wrap_auth_uid_initplan.sql`, `20260907153604_f1_2_rrhh_contratos.sql`, `20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql`, `20261014203144_nexo_usuarios_roles_esquema.sql` (`fn_exigir_permiso`, `fn_auditar`), `20261018014127_asistencia_reportes.sql`, `20261020184030_presupuesto_esquema.sql`, `20261021160943_rrhh_planilla_paso_cero.sql`; `supabase/tests/run_rrhh_pglite.mjs`, `rrhh_kiosco_entorno.sql`, `rrhh_p3_contrato.prueba.sql`, `README.md`; `package.json` (`test:db`, `verify`); `docs/CI_CHECKS.md`; `docs/planning/ARQUITECTURA_MVP_ESCALABLE.md` §2.1–§2.2 |
| Archivos | `SKILL.md`, `references/modelo-datos.md`, `motor-calculo.md`, `estados-y-permisos.md`, `pruebas-doradas.md`, `checklist-revision.md`. Sin scripts, sin `allowed-tools`, sin bloques de comandos ejecutables, sin red |
| Licencia | Contenido propio del proyecto |

## Fuentes externas

Ninguna. El plan 20 menciona Coati Payroll como referencia de código abierto con
licencia no confirmada: no se consultó ni se tomó nada de él.

## Contenido de terceros con instrucciones al agente

Ninguno.

## Evaluación

No se probó en una tarea delegada: el esquema y las RPC no existen todavía. La
skill se contrastó con los archivos del repo citados arriba (rutas y líneas
leídas el 2026-10-21). El estado remoto (`nexo-core`) no se verificó: el
especialista no tiene el MCP de Supabase. Pendiente: medir la skill en PL2
revisando si la migración resultante pasa la checklist sin hallazgos Altos.
