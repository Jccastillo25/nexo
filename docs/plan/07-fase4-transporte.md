# Plan Maestro — FASE 4: Transporte / Flotilla + Panel de Conductor

> Parte de [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](../PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) (índice). Misma vigencia y jerarquía que el documento madre.

---

# 13. FASE 4 — Transporte / Flotilla + Panel de Conductor

Reutilizar `apps/flotilla`; no reconstruir desde cero.

Adaptar:

- schema a `nexo-core`;
- permisos Nexo;
- Multi-Zone;
- vehículos;
- inspecciones;
- anomalías/autorizaciones;
- viajes/eventos GPS;
- evidencias;
- despachos;
- liquidaciones.

## F4.1 Identidad conductor

```text
Empleado RRHH + contrato activo
        ↓
Habilitar conductor
        ↓
crear/reutilizar auth.users
        ↓
rol/permisos Transporte
```

Eliminar identidad/persona duplicada de Ruta360.

## F4.2 Panel de Conductor Web

Login propio operacional por **usuario + contraseña**, aunque use el mismo backend Supabase Auth.

Contenido mínimo:

- viaje actual;
- vehículo;
- inspección;
- operación de viaje;
- incidencias;
- evidencias;
- historial;
- liquidaciones cuando aplique.

No exponer administración completa.

## F4.3 Primera vertical Mobile

Esta fase debe dejar operativo el primer flujo móvil real de conductor.
