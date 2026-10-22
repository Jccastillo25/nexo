# Checklist de revisión — Planilla (reviewer)

Formato de hallazgo (el mismo de nexo-security):

```
- <archivo>:<línea> — [Crítica|Alta|Media|Baja] <sección> — <evidencia> → <recomendación>
```

Gravedad específica de planilla:
- **Crítica**: un usuario puede ver salarios de otra empresa, aprobar o pagar sin permiso, alterar una planilla aprobada, o una RPC escribe sin validar permiso.
- **Alta**: un monto no reproduce un caso dorado; tasa o tramo escrito en el código; separación de funciones evitable; neto negativo posible; tabla de hechos sin particionar.
- **Media**: falta auditoría de una transición; aviso obligatorio ausente; prueba obligatoria faltante; mensaje con detalles internos.
- **Baja**: nombres, comentarios, orden de líneas en colilla.

Lo que ya existía en `main` se marca **(pre-existente)**.

## A. Cálculo

- [ ] Ningún porcentaje, monto, tramo ni feriado literal en TypeScript ni en la RPC (buscar `0.07`, `0.215`, `0.225`, `0.02`, `100000`, `11350`, `/ 30` fuera de la función del diario).
- [ ] Parámetros leídos con vigencia al `periodo_fin`; si falta, error con motivo.
- [ ] Diario `round(mensual / 30, 4)`; montos por días u horas `round(…, 2)` por línea; totales = suma de líneas.
- [ ] Todo en `numeric`; ningún `float`, `real`, `double precision` ni cálculo en JavaScript.
- [ ] Orden de cálculo de motor-calculo.md §2; deducciones en el orden de formulas.md §5.
- [ ] Régimen leído de `contrato_regimen`; sin fila ⇒ error. Coherencia régimen ↔ INSS ↔ IR validada en la RPC.
- [ ] Aguinaldo sin descuentos ni IR (art. 97). Préstamos no tocan el aguinaldo en la liquidación.
- [ ] Indemnización según causa (arts. 43, 45, 47, 48), mínimo 30 días, máximo 150.
- [ ] Casos dorados G1–G7 presentes y en verde (`test:db`).

## B. Permisos y separación de funciones

- [ ] Cada RPC llama `core.fn_exigir_permiso` con el código exacto de estados-y-permisos.md, antes de leer o escribir.
- [ ] Cada Server Action llama `requirePermission` antes de la RPC; la UI oculta o deshabilita el control (`hasPermission`).
- [ ] Aprobar planilla: rechaza si `auth.uid()` = `calculada_por` o creador. Igual en liquidaciones y en vacaciones registradas.
- [ ] Ningún código de permiso nuevo sin Paso Cero aprobado.

## C. Estados e inmutabilidad

- [ ] Transiciones válidas solo por RPC; trigger que bloquea cambios en `aprobada`/`pagada`/`anulada`.
- [ ] Recalcular es idempotente y borra solo líneas de esa planilla.
- [ ] Aprobar compara `hash_insumos`; guarda `hash_aprobado`.
- [ ] Anular exige motivo, libera novedades y cuotas, deja rastro; `pagada` no se anula sin decisión.
- [ ] Concepto usado en planilla aprobada no cambia sus reglas.

## D. Datos, particiones, RLS y GRANT

- [ ] `planilla_lineas` y `novedades` nacen `partition by range` con la clave en la PK; función de partición con `%I`/`%L`, índices y RLS por partición; registradas en `core.tablas_particionadas`.
- [ ] Toda tabla nueva: RLS habilitado, policy de `select` con `core.has_permission((select auth.uid()), company_id, …)`, `grant select` a `authenticated`, sin `insert/update/delete`, nada para `anon`.
- [ ] FKs compuestas `(id, company_id)`; índice en cada FK; `(company_id, fecha)`.
- [ ] Funciones `security definer` con `search_path = ''`, nombres calificados, `revoke … from public, anon`, `grant execute … to authenticated` solo en `public.planilla_*`; poscheques con `has_function_privilege`.
- [ ] Migración con prechequeo, poscheque y rollback comentado; no edita migraciones aplicadas.

## E. Auditoría y errores

- [ ] `core.fn_auditar` en crear, calcular, aprobar, pagar, anular, cambio de parámetro, régimen, concepto, aviso descartado, exportación.
- [ ] Mensajes en español, sin SQLSTATE ni nombres de tablas al usuario.

## F. Evidencia

Al final del informe: **Comprobado** (comando y resultado, p. ej. `npx.cmd --yes pnpm@9.15.9 test:db` en verde con los scripts de planilla) y **Pendiente / no comprobado** (RLS real, advisors, ensayo remoto, corrida en paralelo con AG). Nunca "validado" con solo PGlite.
