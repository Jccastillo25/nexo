# Paso Cero — matriz de permisos de contratos/credenciales, APLICADA (2026-09-07)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0.10 antes de la reestructuración de 2026-09-11.

Aprobada explícitamente por el usuario con nomenclatura y asignación exactas. Migración `20260907151643_rrhh_contratos_permission_matrix`, reutiliza el dominio `expedientes` ya existente (no crea un dominio `contratos` nuevo):

```text
rrhh.expedientes.contratos.ver
rrhh.expedientes.contratos.crear
rrhh.expedientes.contratos.editar
rrhh.expedientes.contratos.activar
rrhh.expedientes.contratos.finalizar
rrhh.expedientes.credenciales.ver
rrhh.expedientes.credenciales.regenerar
```

Asignación aplicada y verificada en remoto (`core.app_role_permissions`):

| Permiso | admin | gestor_expedientes | supervisor_asistencia | especialista_planillas | consulta |
|---|---:|---:|---:|---:|---:|
| contratos.ver | ✅ | ✅ | — | — | — |
| contratos.crear | ✅ | ✅ | — | — | — |
| contratos.editar | ✅ | ✅ | — | — | — |
| contratos.activar | ✅ | — | — | — | — |
| contratos.finalizar | ✅ | — | — | — | — |
| credenciales.ver | ✅ | ✅ | ✅ | — | — |
| credenciales.regenerar | ✅ | — | — | — | — |

`credenciales.ver` es exclusivamente estado de la credencial (activa/bloqueada) — nunca el PIN en texto plano. El PIN solo se muestra una vez, en `contratos.activar` o `credenciales.regenerar`.

**Explícitamente NO incluido** (decisión del usuario, diseño objetivo documentado pero sin implementar): `core.identidad.cuenta.ver/provisionar/bloquear/restablecer` — capacidad transversal de Nexo (Core), no de RRHH; no se asigna a `rrhh.admin`. `flotilla.conductores.acceso.*` — eliminado de la propuesta, la provisión/bloqueo de identidad es exclusiva de `core.identidad`, nunca duplicada por módulo. `flotilla.conductores.perfil.*`/`viajes.*` quedan previstos para el Paso Cero de Fase 4, sin insertar todavía.

Con esto, el Paso Cero de permisos para F1.1–F1.3 queda cerrado. Próximo paso: F1.1.
