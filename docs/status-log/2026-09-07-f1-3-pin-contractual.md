# F1.3 — PIN exclusivamente contractual (ejecutado 2026-09-07)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0.13 antes de la reestructuración de 2026-09-11.

Regla objetivo cumplida: **SIN CONTRATO ACTIVO → SIN PIN**. Migración `20260907154715_f1_3_pin_exclusivamente_contractual` + 2 correcciones (`20260907154858`, `20260907154942`, ver abajo):

- **`rrhh.contrato_credenciales`** (nueva, 1:1 con el contrato): `pin_hash`, `activo`, `pin_bloqueado`, `intentos_fallidos`, `rotacion_numero`, `creado_at/by`, `revocado_at/by`. RLS habilitado **sin ninguna policy** (deny-by-default total, mismo criterio que `rrhh.seguridad_accesos`/`kiosko_rate_limits`) y **sin `GRANT` de `SELECT` a nadie** — ni siquiera `authenticated`. `pin_hash` nunca se expone vía select directo, solo vía RPC que ni siquiera lo leen en su respuesta.
- **`rrhh.fn_activar_contrato`** (reemplazada, cambio de tipo de retorno): ahora genera el PIN al activar y lo devuelve en texto plano **una sola vez**.
- **`rrhh.fn_finalizar_contrato`**: ahora revoca la credencial (`activo = false`) al finalizar.
- **`rrhh.fn_regenerar_pin_contrato`** (nueva): único camino para regenerar — exige contrato `activo`, gateada por `rrhh.expedientes.credenciales.regenerar`.
- **`rrhh.fn_estado_credencial_contrato`** (nueva): único camino de lectura — devuelve `activo`/`pin_bloqueado`/`rotacion_numero`, **nunca** el PIN ni el hash. Gateada por `rrhh.expedientes.credenciales.ver`.
- **`rrhh.fn_registrar_marca_kiosko`** (kiosko en producción, reescrita): valida contra `rrhh.contrato_credenciales` + `rrhh.contratos.estado='activo'` en vez de `rrhh.empleados.pin_hash/estado/pin_bloqueado` (deprecados desde F1.1). **Misma firma, mismo rate-limit persistente, misma lógica anti-enumeración (`RETURN`, nunca `RAISE EXCEPTION`), misma inferencia de entrada/salida** — único cambio es de dónde sale la credencial válida.

## Verificación end-to-end real (no solo esquema)

A diferencia de F1.1/F1.2 (verificadas por esquema/constraints), F1.3 se verificó **invocando las funciones de verdad**, simulando `auth.uid()` vía `request.jwt.claims` contra un usuario real (`owner`) y datos de prueba (empleado + contrato + kiosko dedicados, todos borrados al final — 0 filas antes y después en todas las tablas de RRHH):

1. Crear empleado → 2. crear contrato con salario → 3. activar (PIN devuelto una vez) → 4. marcar entrada en kiosko de prueba → 5. marcar salida → 6. ver estado de credencial (activa, rotación 1, sin PIN expuesto) → 7. regenerar PIN → 8. **PIN anterior rechazado** → 9. **PIN nuevo acepta marca** → 10. finalizar contrato → 11. **PIN rechazado después de finalizar**.

Negativos: usuario sin permiso → `Permiso denegado` (no crashea, no filtra datos); `company_id` cruzado (empresa donde el usuario no tiene membresía) → rechazado — confirma aislamiento entre empresas.

## 2 bugs reales encontrados y corregidos en el momento (no detectables por revisión de esquema)

Esta prueba end-to-end encontró que **ni `rrhh.fn_crear_empleado` (F1.1) ni `rrhh.fn_crear_contrato` (F1.2) podían ejecutarse nunca** — ambas fallaban con `column reference ... is ambiguous`. Causa: `RETURNS TABLE(...)` declara variables `OUT` implícitas con el mismo nombre que las columnas reales, y la cláusula `RETURNING id, codigo_empleado`/`RETURNING id, numero_contrato` sin alias de tabla queda ambigua entre ambas. Ninguna de las pruebas de esquema de F1.1/F1.2 (que hacían `INSERT` crudo, no llamaban a la función) lo detectó.

- `20260907154858_fix_crear_empleado_returning_ambiguous`: agrega alias de tabla (`insert into rrhh.empleados as e ... returning e.id, e.codigo_empleado`). Sin cambio de firma ni comportamiento.
- `20260907154942_fix_crear_contrato_returning_ambiguous`: mismo fix para `rrhh.fn_crear_contrato`.

**Lección para el resto de F1.4 en adelante**: verificar cada RPC nuevo con una llamada real (simulando `auth.uid()`), no solo con `INSERT`/`UPDATE` crudo contra las tablas — el esquema puede ser correcto y la función que lo envuelve seguir rota.

D-02 y D-06 quedan **completamente cerrados** (no solo el componente de seguridad inmediato): el PIN nace únicamente al activar un contrato, se revoca al finalizar, y el kiosko ya no depende en absoluto de `rrhh.empleados.pin_hash`.

**No verificado en navegador/UI** — mismo `EPERM` de entorno. Frontend nuevo: reveal-once de PIN en "Activar"/"Regenerar PIN", badge de estado de credencial, en `contratos-panel.tsx`.

## Addendum — Definition of Done de F1.3, recorrido de 23 pasos (verificado)

El recorrido exacto pedido para declarar F1.3 terminada, verificado con datos de prueba reales vía simulación de `auth.uid()` — no solo revisión de esquema:

| # | Paso | Resultado |
|---|---|---|
| 1-2 | Crear expediente general / confirmar sin PIN | ✅ |
| 3-4 | Crear contrato borrador / confirmar sin PIN | ✅ |
| 5 | Editar contrato borrador | ✅ (verificado en F1.2, sin cambios en F1.3) |
| 6-9 | Activar como admin / generar PIN / mostrarlo una vez / guardar solo hash | ✅ |
| 10 | Ver estado de credencial sin revelar PIN | ✅ |
| 11 | Marcar en kiosko usando PIN | ✅ |
| 12-14 | Regenerar PIN como admin / PIN anterior deja de funcionar / PIN nuevo funciona | ✅ |
| 15-18 | Finalizar contrato / PIN revocado / no nuevas marcas / historial intacto | ✅ |
| 19-20 | Probar `gestor_expedientes`/`supervisor_asistencia` y sus denegaciones | ⚠️ **no verificado con esos roles específicos** — verificado sí con `owner` (bypass) y con un usuario sin ningún permiso (rechazado). Los 4 roles no-admin heredan sus permisos exactos de la matriz aplicada en el Paso Cero, pero no se probó cada uno por separado con una sesión real. |
| 21 | Probar `consulta` y usuario sin permisos | ⚠️ mismo alcance que 19-20 — probado genéricamente "sin permiso", no con el rol `consulta` específico |
| 22 | Llamada RPC directa y RLS | ✅ (las funciones probadas SON la llamada RPC directa; RLS de `rrhh.contratos`/`contrato_compensacion` confirmado con `pg_policies`, sin policy de `SELECT`/`INSERT`/`UPDATE`/`DELETE` que permita saltarse el modelo) |
| 23 | Ejecutar security advisors | ✅ `get_advisors(security)` corrido después de cada migración de F1.3 — sin exposición nueva a `anon`, solo los WARN esperados de `authenticated` (mismo patrón ya aceptado) |

**Pendiente real, no crítico**: pasos 19-21 probados con `owner` (bypass total) y con un `user_id` sin ninguna fila de permiso, pero no con sesiones reales de `gestor_expedientes`/`supervisor_asistencia`/`especialista_planillas`/`consulta` — no hay usuarios de prueba con esos roles asignados en el proyecto remoto todavía. La lógica de autorización es idéntica para todos los roles (una sola llamada a `core.has_permission`), pero una prueba con usuarios reales por rol queda como verificación adicional recomendada antes de dar por "validado" (no solo "implementado") el checklist de seguridad completo — ver la distinción que exige `CLAUDE.md`. Queda para F1.9.
