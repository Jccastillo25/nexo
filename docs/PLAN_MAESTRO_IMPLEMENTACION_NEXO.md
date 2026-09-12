# Nexo — Plan Maestro de Implementación (índice)

> **Fuente de verdad de ejecución.** Este documento y los archivos de [`docs/plan/`](plan/) definen el orden de implementación, reglas de dominio, arquitectura objetivo y Definition of Done de Nexo. Antes de modificar código o base de datos se debe comparar contra `main`, el remoto real y `docs/IMPLEMENTATION_STATUS.md`.
>
> **Este archivo es un índice, no el documento completo.** Desde 2026-09-11 el contenido temático (objetivo, arquitectura, reglas de dominio y cada fase) vive en archivos separados bajo `docs/plan/` para que una sesión lea solo lo que aplica a su tarea, no las ~980 líneas del monolito anterior. Las reglas transversales que aplican siempre (decisiones vigentes, orden definitivo, Definition of Done universal, protocolo obligatorio) se quedan aquí porque son cortas y se leen en toda sesión.

## Decisiones de negocio vigentes — 2026-09-06

1. RRHH separa estrictamente **Expediente General** y **Expediente Laboral**.
2. El **PIN** no pertenece al alta general: nace únicamente al activar un contrato laboral válido.
3. El PIN es **exclusivamente para asistencia/kiosko**. No es contraseña de Web ni Mobile.
4. El acceso digital operativo usa **usuario + contraseña administrados por Supabase Auth**.
5. La identidad digital pertenece al empleado; Transporte/CRM/Fabricación agregan roles/permisos, no cuentas duplicadas.
6. El Panel de Conductor Web y Nexo Mobile comparten la misma identidad digital.
7. **Nexo Mobile no replica toda la versión Web**: solo muestra funciones operacionales aprobadas por rol/permisos.
8. Nexo debe prepararse desde ahora para Android/iOS mediante RPC/servicios reutilizables, no lógica encerrada en Next.js.

Fuente específica de acceso: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

---

## Índice temático (`docs/plan/`)

Leer **solo el archivo que aplica a la tarea actual**, además de esta página. No hace falta leer los 11 archivos en cada sesión.

| Archivo | Contenido | Leer cuando la tarea toque… |
|---|---|---|
| [`plan/01-objetivo-arquitectura-accesos.md`](plan/01-objetivo-arquitectura-accesos.md) | Objetivo de Nexo, arquitectura base que se conserva, las tres superficies de acceso (Web/Kiosko/Conductor) | orientación general, cualquier decisión de arquitectura transversal |
| [`plan/02-estrategia-movil.md`](plan/02-estrategia-movil.md) | Nexo Mobile Android/iOS: alcance, backend compartido, seguridad, offline-first | cualquier lógica nueva que deba ser reutilizable Web/Mobile, o trabajo directo de `apps/mobile` |
| [`plan/03-rrhh-dominio.md`](plan/03-rrhh-dominio.md) | Reglas obligatorias de RRHH (Expediente General/Laboral, PIN contractual, entrada/salida), identidad digital del empleado, habilitación de conductor, modelo de datos objetivo, Paso Cero de permisos | RRHH, identidad digital, habilitación/deshabilitación de conductor |
| [`plan/04-fase1-rrhh.md`](plan/04-fase1-rrhh.md) | FASE 1 completa — subfases F1.0 a F1.10, Definition of Done RRHH | trabajo activo de Fase 1 (RRHH) |
| [`plan/05-fase2-kernel-compartido.md`](plan/05-fase2-kernel-compartido.md) | FASE 2 — `@nexo/supabase`, `@nexo/auth`, identidad operacional | Fase 2 |
| [`plan/06-fase3-crm.md`](plan/06-fase3-crm.md) | FASE 3 — CRM MVP real | Fase 3 (CRM) |
| [`plan/07-fase4-transporte.md`](plan/07-fase4-transporte.md) | FASE 4 — Transporte/Flotilla + Panel de Conductor | Fase 4 (Transporte/`apps/flotilla`) |
| [`plan/08-fase5-inventario.md`](plan/08-fase5-inventario.md) | FASE 5 — Inventario mínimo | Fase 5 (Inventario) |
| [`plan/09-fase6-fabricacion.md`](plan/09-fase6-fabricacion.md) | FASE 6 — Fabricación | Fase 6 (Fabricación) |
| [`plan/10-fase7-mobile.md`](plan/10-fase7-mobile.md) | FASE 7 — Nexo Mobile consolidado Android/iOS | Fase 7 (app móvil como producto) |
| [`plan/11-fase8-integracion.md`](plan/11-fase8-integracion.md) | FASE 8 — Integración completa + integraciones internas (RPC cross-schema) | Fase 8, o cualquier integración entre módulos existentes |

---

# 19. Orden definitivo

```text
FASE 1  RRHH completo + separar PIN de login
FASE 2  Kernel compartido + identidad digital operacional
FASE 3  CRM real
FASE 4  Transporte adaptado + Panel Conductor + primera vertical Mobile
FASE 5  Inventario mínimo
FASE 6  Fabricación
FASE 7  Nexo Mobile consolidado Android/iOS
FASE 8  Integración completa
```

---

# 20. Definition of Done universal

## Infraestructura

- app/schema;
- permisos/roles;
- RLS;
- Auth;
- deployment/build.

## Funcionalidad

Caso principal de punta a punta.

## Integración

No duplica fuentes de verdad y conecta módulos correctamente.

## Validación

- roles;
- sin permiso;
- seguridad;
- errores;
- auditoría;
- transacciones;
- E2E;
- documentación actualizada.

Para Mobile además:

- Android probado;
- iOS probado;
- permisos nativos;
- secure storage;
- offline/reconexión;
- sincronización idempotente.

---

# 21. Protocolo obligatorio para Claude

Antes:

1. leer `CLAUDE.md`;
2. leer este índice + el/los archivo(s) de `docs/plan/` que aplican a la tarea (tabla de arriba);
3. leer `IMPLEMENTATION_STATUS.md` (dashboard corto) + la entrada específica de `docs/status-log/` si se necesita el detalle de verificación de una subfase ya cerrada;
4. leer `DRIVER_ACCESS_AND_KIOSK.md` cuando toque RRHH/Transporte/Auth/Mobile;
5. leer documentación específica;
6. verificar remoto cuando aplique.

Comparar:

```text
PLAN
vs
MAIN
vs
MIGRACIONES
vs
BASE REMOTA
vs
DEPLOYMENT
vs
ESTADO DOCUMENTADO
```

Durante:

- ejecutar una subfase concreta;
- Paso Cero de permisos;
- no editar migraciones aplicadas;
- no duplicar identidad ni fuentes de verdad;
- lógica reutilizable Web/Mobile en RPC/servicios;
- no considerar hecho solo porque compila.

Después:

- tests/build;
- remoto verificado;
- actualizar `IMPLEMENTATION_STATUS.md` (dashboard) **y** agregar una entrada nueva en `docs/status-log/` con el detalle completo de la subfase (fecha + slug: `YYYY-MM-DD-slug.md`) — no volver a convertir `IMPLEMENTATION_STATUS.md` en un monolito narrativo;
- actualizar docs específicos;
- actualizar ROADMAP/MODULES cuando cambie estado;
- registrar commit/migraciones/pruebas;
- commit + push de código y documentación.

---

# 22. Prioridad inmediata

```text
F1.0 Auditoría RRHH
 ↓
F1.1 Expediente General/Laboral
 ↓
F1.2 Contratos
 ↓
F1.3 PIN solo asistencia
 ↓
F1.4 Jornadas
 ↓
F1.5 Asistencia
 ↓
F1.6 Incidencias
 ↓
F1.7 Planillas
```

En paralelo conceptual, preparar la identidad digital sin implementar todavía duplicaciones:

```text
Persona
├── Contrato → PIN → Kiosko
└── auth.users → roles/permisos → Panel Conductor Web / Nexo Mobile
```

Ese es el modelo obligatorio hacia adelante.
