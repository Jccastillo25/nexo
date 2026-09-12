# Plan Maestro — FASE 1: Cerrar RRHH

> Parte de [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](../PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) (índice). Misma vigencia y jerarquía que el documento madre. Estado real de avance: [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md) §3 (tablero de ejecución) y [`docs/status-log/`](../status-log/).

---

# 10. FASE 1 — Cerrar RRHH

No iniciar CRM/Fabricación antes de RRHH MVP completo.

## F1.0 — Auditoría real

Verificar:

- `main`;
- Supabase remoto;
- Vercel;
- datos;
- permisos/roles;
- RPC;
- security advisors;
- migraciones existentes;
- `nombre_usuario`, `user_id`, `pin_hash`;
- `fn_validar_acceso_operativo()`;
- cualquier consumidor del diseño PIN de doble propósito.

Actualizar `IMPLEMENTATION_STATUS.md` con la realidad.

## F1.1 — Separar Expediente General/Laboral

`expedientes/nuevo` solo crea datos generales.

## F1.2 — Contratos + compensación contractual

Crear permisos aprobados, tablas, RLS, RPC, UI histórica y transiciones de contrato.

## F1.3 — PIN exclusivamente de asistencia

- generar solo al activar contrato;
- hash y retorno una vez;
- kiosko valida contrato activo;
- revocar al finalizar;
- regenerar solo con contrato activo;
- eliminar/deprecar uso de PIN como login operativo;
- mantener rate-limit/anti-enumeración.

## F1.4 — Jornadas mínimas

Jornadas, días, horarios, descanso, tolerancias, feriados y asignación contractual.

## F1.5 — Consolidación asistencia

```text
marcas → pares → contrato+jornada → cálculo → incidencias → resumen diario
```

## F1.6 — Incidencias/justificaciones

Supervisor corrige/justifica/rechaza antes de planilla cuando corresponda.

## F1.7 — Motor de planillas

Período → contratos → asistencia consolidada → compensación → parámetros legales → movimientos → snapshot → borrador/revisión/cierre.

## F1.8 — Administración de kioscos

UI para listar, crear, editar, activar/desactivar y revocar kioscos.

## F1.9 — Seguridad/RBAC/E2E

Probar roles, RLS, RPC directa, PIN inválido, contrato finalizado, kiosko inválido, rate limit y advisors.

## F1.10 — Definition of Done RRHH

```text
1 Crear Expediente General
2 Confirmar sin PIN
3 Crear contrato borrador
4 Confirmar sin PIN
5 Completar compensación/jornada
6 Activar contrato
7 Recibir PIN una vez
8 Marcar entrada
9 Marcar salida
10 Consolidar horas
11 Resolver incidencias
12 Generar planilla
13 Verificar reporte
14 Finalizar contrato
15 Confirmar PIN revocado
16 Confirmar historial intacto
17 Probar roles/denegaciones
```
