# F1.4 — Jornadas mínimas (ejecutado 2026-09-07)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0.14 antes de la reestructuración de 2026-09-11.

Modelo objetivo cumplido: `Empleado → Contrato → Asignación de jornada
(histórico por vigencia) → Jornada (plantilla) → Días/horarios`. Revisión
previa obligatoria del stash `feat/rrhh-jornadas-y-horas` (ver
[`MIGRATION_LOG.md`](../MIGRATION_LOG.md) para el detalle completo de la
clasificación) — contenía solo documentación, sin migraciones ni código;
incompatible/descartable para reutilizar literalmente (FK a `empleado_id`,
alcance mayor a F1.4). Stash intacto, sin `pop`.

Migraciones (aplicadas y verificadas):

- `20260907162904_f1_4_jornadas_permission_matrix` +
  `20260907162929_fix_f1_4_feriados_admin_role_missing` (Paso Cero,
  aprobado explícitamente por el usuario): único código nuevo,
  `rrhh.asistencia.feriados.{ver,crear,editar,eliminar}`. Reutiliza sin
  cambios `rrhh.asistencia.turnos.*` (jornadas) y
  `rrhh.expedientes.contratos.editar` (asignación a contrato) — sin
  duplicar ningún código existente.
- `20260907163244_f1_4_rrhh_jornadas_minimas`: `rrhh.jornadas` +
  `rrhh.jornada_dias` (plantilla + reglas por día, un único bloque
  entrada/salida, escritura directa vía RLS); `rrhh.contrato_jornadas`
  (histórico de asignación por vigencia, `EXCLUDE USING gist` contra
  solapamientos, escritura solo vía `rrhh.fn_asignar_jornada_contrato`);
  `rrhh.feriados` (catálogo simple, sin tipo/pago). RPC nuevas:
  `fn_asignar_jornada_contrato`, `fn_jornada_vigente_contrato` (interfaz
  de solo lectura para F1.5). `rrhh.fn_activar_contrato` (`create or
  replace`) ahora exige jornada asignada — **decisión explícita del
  usuario: jornada obligatoria para activar un contrato**.

Estrategia de versionado (definida, no solo implementada): sin tabla
`jornada_versiones` adicional — mantiene el modelo mínimo de 4 tablas
pedido. `jornada_dias` queda editable en vivo; la garantía de "no alterar
retroactivamente un período cerrado" la da `contrato_jornadas` (qué
jornada aplicaba a qué contrato en qué fecha) combinada con que **F1.5
deberá snapshotear** las reglas del día dentro de
`asistencia_resumen_diario` en el momento del cálculo — mismo criterio ya
documentado para `planilla_detalles` (F1.7). Sin motor de consolidación
construido todavía (fuera de alcance de F1.4).

## Verificación end-to-end real (RPC, no solo esquema)

Simulando `auth.uid()` vía `request.jwt.claims` (empleado + 2 jornadas +
contrato de prueba, 0 filas antes y después en todas las tablas
afectadas):

1. Crear jornada con días completos (7/7) → 2. asignar a contrato borrador
→ 3. **activar sin jornada rechazado explícitamente antes de crear la
jornada** → 4. jornada vigente por fecha resuelta correctamente (día de
semana correcto) → 5. reasignar con vigencia histórica: cierra la fila
abierta anterior (`vigente_hasta` = día antes de la nueva vigencia), abre
una nueva, sin sobreescribir → 6. solapamiento inválido (`vigente_desde`
no posterior a la asignación actual) rechazado → 7. cross-company
(`company_id` ajena) rechazado → 8. activar CON jornada asignada: aceptado
(PIN generado) → 9. finalizar contrato: histórico de `contrato_jornadas`
permanece intacto (2 filas), credencial revocada → 10. feriados: crear +
duplicado en misma fecha/empresa rechazado.

Negativos adicionales: usuario sin permiso rechazado tanto en
`asignar_jornada_contrato` como en `jornada_vigente_contrato` (llamada RPC
directa); RLS directa confirmada dos veces — lectura (`SELECT` devuelve 0
filas sin permiso) e inserción directa (`INSERT` rechazado con "row-level
security policy", nunca llega a escribir); jornada con histórico real
protegida contra `DELETE` físico por la FK (`on delete restrict`, sin
trigger aparte). `get_advisors(security)`: sin exposición nueva a `anon`;
`get_advisors(performance)`: solo INFO pre-existente (FK sin índice de
cobertura en `created_by`/`jornada_id`, índices nuevos sin uso —
esperable con 0 filas reales, mismo patrón que el resto del schema).

**Pendiente real, señalado — no una decisión tomada por Claude**: el
selector de jornada en la UI de `/rrhh/expedientes/[id]` requiere
`rrhh.asistencia.turnos.ver` para listar las jornadas disponibles.
`gestor_expedientes` (quien completa el contrato, incluida la jornada, en
el flujo aprobado) tiene `contratos.editar` pero NO `turnos.ver` — puede
asignar por RPC pero no ve el listado en el selector. Es una extensión de
rol sobre un permiso YA existente, no un código nuevo, pero cambia quién
puede hacer qué — no estaba en el diff de Paso Cero aprobado, así que no
se aplicó unilateralmente. Queda para aprobación aparte antes de F1.5.

**No verificado en navegador/UI** — mismo `EPERM` de entorno (2026-09-05),
reconfirmado en esta sesión (`npx tsc --noEmit` falla con el mismo
`EPERM: operation not permitted, open .../typescript/bin/tsc`). Sustituido
por la validación equivalente que pide `CLAUDE.md` cuando el entorno local
sigue bloqueado: **build real de Vercel**, verificado después del push a
`main` (commit `a68c5e9`) — `get_deployment` confirma `readyState: READY`
para los 3 proyectos que reconstruyen por el cambio en `packages/ui`:
`nexo-rrhh` (`dpl_Equ2aDaRAQkZeo2xj1LS3RygomUh`), `nexocore`
(`dpl_BnyqWBwskpZChmdbUgnxx5Uwoi7a`) y `nexo-crm`
(`dpl_J5yCKqDZHT2RbkGWtzSt2uFxWbUm`) — es decir, `tsc`/`next build` SÍ se
ejecutaron, en Vercel, sobre este código exacto, sin error. `get_runtime_errors`
de `nexo-rrhh` (ventana de 30 min post-deploy): sin errores nuevos. Esto
verifica que el código **compila y despliega**, no que el flujo funciona
visualmente en un navegador — la UI de `/rrhh/jornadas` y la sección
"Jornada" de `/rrhh/expedientes/[id]` no fueron clickeadas por nadie.
Frontend nuevo: `/rrhh/jornadas` (`page.tsx` + `jornadas-panel.tsx` +
`feriados-panel.tsx` + `actions.ts`) y sección "Jornada" agregada a
`contratos-panel.tsx`/`actions.ts` en `/rrhh/expedientes/[id]`. Tipos
(`database.types.ts` de `apps/rrhh` y su espejo en `apps/crm`)
actualizados a mano, verificados contra `generate_typescript_types` (los
`Args`/`Returns` de las 2 RPC nuevas coinciden exactamente).

**Pruebas por rol real (19-21 del recorrido de F1.3) — misma limitación
que F1.3, no cerrada aquí tampoco**: sin usuarios de prueba con
`gestor_expedientes`/`supervisor_asistencia`/`especialista_planillas`/
`consulta` asignados en el proyecto remoto. Verificado con `owner`
(bypass total) y con un `user_id` sin ninguna fila de permiso (rechazado).
Queda para F1.9, igual que en F1.3.
