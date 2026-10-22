---
name: nexo-planilla-motor
description: Modelo de datos y motor de cálculo de Planilla de RRHH en Postgres (contrato_regimen con vigencia, catálogo de conceptos, tipos de planilla, planilla_lineas y novedades particionadas por mes, préstamos, embargos, vacaciones, provisiones, liquidaciones, tramos de IR), con RPC security definer, orden de cálculo, redondeo, idempotencia, estados con separación de funciones, auditoría, pruebas doradas en PGlite y checklist de revisión. Usar al diseñar, escribir, ensayar o revisar migraciones y RPC de planilla, vacaciones, préstamos o liquidaciones.
---

# Nexo Planilla — modelo de datos y motor en RPC

Adaptación estable al proyecto. Fuente: [SOURCE.md](SOURCE.md). Las fórmulas y
los valores legales están en [nexo-planilla-legal](../nexo-planilla-legal/SKILL.md);
aquí, cómo se guardan, se calculan y se protegen. Qué migración escribir, los
archivos autorizados y las pruebas exactas los da el coordinador.

Complementa, no repite:
- [nexo-security](../nexo-security/SKILL.md) §1–§3 y §7: permisos v3.0, RLS/GRANT, `security definer`, validación de entrada.
- [nexo-planilla-flujos](../nexo-planilla-flujos/SKILL.md): qué pantalla llama a cada RPC.

## Cuándo se utiliza

- Escribir la migración de esquema PL2 o cualquier RPC de planilla, vacaciones, préstamos, embargos, liquidaciones o declaraciones.
- Escribir pruebas doradas en `supabase/tests/`.
- Revisar un diff de planilla: [references/checklist-revision.md](references/checklist-revision.md).

## Contexto que debe consultar

1. `docs/plan/20-planilla.md` §7 (modelo), §8 (Paso Cero y matriz), §10 (etapas).
2. `supabase/migrations/20261021160943_rrhh_planilla_paso_cero.sql` (los 15 códigos nuevos) y `20260902000005_rrhh_permissions_and_roles.sql:48-55` + `20260902000008…:175-178` (los 10 anteriores). Lista completa en [references/estados-y-permisos.md](references/estados-y-permisos.md).
3. Precedentes del repo: `20260902000006_rrhh_schema_and_tables.sql:166-212` (tablas que se reemplazan), `20260907153604_f1_2_rrhh_contratos.sql` (escritura solo por RPC, trigger de transiciones), `20261018014127_asistencia_reportes.sql` (RPC `public.*` con `search_path = ''`, validación 42501/22023, revocaciones y poscheques), `20261020184030_presupuesto_esquema.sql:114-202` (tablas particionadas y `core.tablas_particionadas`).
4. `supabase/tests/README.md`, `supabase/tests/run_rrhh_pglite.mjs`, `docs/CI_CHECKS.md` (qué prueba y qué no prueba PGlite).

## Reglas estables

1. **Paso Cero ya hecho, no se amplía sin aprobación.** Hay 25 códigos `rrhh.planillas.*`. Una RPC que necesite un código que no existe se detiene y se reporta (huecos conocidos en estados-y-permisos.md).
2. **Esquema `rrhh` (patrón A) con escritura solo por RPC**: RLS en toda tabla y partición; `grant select` a `authenticated` y **ningún** `insert/update/delete` directo (precedente `contrato_compensacion`, `20260907153604…:149-158`). Poscheque con `has_table_privilege`.
3. **RPC**: `public.planilla_*` con `security definer`, `set search_path = ''`, nombres calificados, `core.fn_exigir_permiso(p_company_id, '<código>')` antes de leer o escribir, filtro por `company_id` y por id; `revoke … from public, anon` + `grant execute … to authenticated`. Núcleos internos `rrhh.fn_planilla_*` sin EXECUTE para la API (poscheque `has_function_privilege`, como `20261018014127…:465-479`).
4. **Hechos particionados por mes desde el primer `create table`**: `planilla_lineas` y `novedades` (plan 20 §7). Ver [references/modelo-datos.md](references/modelo-datos.md) para la clave de partición y la regla para las demás tablas.
5. **Lógica en Postgres, no en Next.js** (Web y Mobile usan las mismas RPC). Server Actions solo validan permiso y llaman a la RPC.
6. **Determinismo**: mismos insumos ⇒ mismas líneas al centavo. Redondeo por línea con `round(numeric, 2)`; totales = suma de líneas. Orden de cálculo fijo: [references/motor-calculo.md](references/motor-calculo.md).
7. **Ciclo de estados con separación de funciones**: `borrador → calculada → aprobada → pagada`, o `anulada`. Quien calcula no aprueba **la misma corrida** aunque tenga ambos permisos; aprobar, pagar, anular, cambiar régimen y aprobar liquidaciones son de `admin`. Una planilla aprobada no se edita: se anula y se genera otra.
8. **Auditoría** con `core.fn_auditar` en cada transición, cambio de parámetro, régimen, concepto, descarte de aviso y exportación.
9. **Multiempresa**: `company_id` en toda tabla y FKs compuestas `(id, company_id)` hacia el recurso padre (precedente `20260918043955…:26-29`).

## Procedimiento para una migración de planilla

1. Diseña contra modelo-datos.md y motor-calculo.md; marca "propuesta" lo que no esté en el plan 20.
2. Escribe la migración con: encabezado (qué, por qué, aprobación del usuario, rollback comentado), **prechequeo** (`do $$ … raise exception 'precheck: …'`), cuerpo, revocaciones y **poscheques** (como `20261021160943`).
3. Escribe las pruebas doradas y de reglas en PGlite: [references/pruebas-doradas.md](references/pruebas-doradas.md).
4. Entrega al coordinador el SQL para el **ensayo en transacción revertida** en `nexo-core` (solo él tiene el MCP). Nunca `apply_migration` desde un subagente.
5. Autorrevisión con checklist-revision.md y nexo-security.

## Restricciones

- No editar migraciones aplicadas; todo cambio es una migración nueva.
- `planilla_detalles` no se borra: se deja de usar (plan 20 §7, deprecación gradual).
- Sin datos personales en semillas ni pruebas; prefijo `PRUEBA`.
- Sin dependencias nuevas; `@electric-sql/pglite` ya está fijado en `0.5.10`.

## Si falta información

Faltan decisiones (estados exactos, IR quincenal, período del aguinaldo, permiso para pagar o anular una liquidación, antigüedad entre contratos): no las inventes; pregúntalas al coordinador. La lista está en motor-calculo.md §8.
