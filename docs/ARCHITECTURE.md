# Arquitectura de Nexo

Estado: vigente desde 2026-08-29, actualizado 2026-09-06 con estrategia Mobile y separación de credenciales operativas.

Ver propuestas históricas en `docs/planning/` y decisiones operativas vigentes en `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`.

---

# 1. Resumen

- **Monorepo**: Turborepo + pnpm workspaces. Una app por módulo en `apps/*`, paquetes compartidos en `packages/*`.
- **Un solo dominio Web**: `nexo.materialesjcastillo.com`.
- **Multi-Zones**: la app `nexo` es zona raíz y reescribe hacia cada módulo desplegado en su propio proyecto Vercel.
- **Base de datos**: un solo proyecto Supabase `nexo-core`, `auth.users` compartido, un schema PostgreSQL por módulo más `core`.
- **Permisos**: DENY-BY-DEFAULT con `core.permissions_catalog`, roles por app, RLS y `core.has_permission()`.
- **Integración**: funciones/RPC de dominio y `core.fn_*` para operaciones atómicas cross-schema.
- **Nexo Mobile**: una sola app Android/iOS, operacional y limitada por roles; no replica toda la Web.

---

# 2. Web: Multi-Zones

Cada aplicación Web mantiene despliegue independiente:

```text
apps/nexo      → zona raíz
apps/crm       → /crm
apps/rrhh      → /rrhh
apps/flotilla  → /flotilla (al adaptar)
```

La ruta registrada en `core.apps.route` siempre es relativa. La URL real de Vercel existe únicamente como destino de rewrite.

Cada proyecto Vercel mantiene sus propias variables de entorno.

Un schema PostgreSQL nuevo requiere `GRANT USAGE` y permisos base sobre tablas además de RLS.

---

# 3. Identidad: dos contextos de sesión, una autoridad

Nexo distingue entre:

1. **sesión digital autenticada**;
2. **marcación física en kiosko**.

No son la misma credencial.

## 3.1 Sesión digital

Web administrativa, Panel de Conductor Web y Nexo Mobile utilizan Supabase Auth.

```text
Cliente Web/Mobile
      ↓
Supabase Auth
      ↓
auth.uid()
      ↓
core.has_permission()
      ↓
RLS / RPC
```

La identidad digital pertenece al empleado/persona, no a un módulo específico.

Evitar múltiples cuentas para la misma persona:

```text
NO:
usuario_transporte
usuario_rrhh
usuario_crm
usuario_fabricacion

SÍ:
1 identidad digital Nexo
+ roles/permisos por módulo
```

## 3.2 Kiosko

El kiosko no abre una sesión de Supabase Auth para el empleado.

```text
Kiosko autorizado
      ↓
PIN contractual
      ↓
validar contrato activo
      ↓
registrar entrada/salida
```

El PIN es exclusivamente una credencial de asistencia.

---

# 4. Separación obligatoria de credenciales

Decisión vigente desde 2026-09-06:

```text
PIN                 = asistencia
usuario+contraseña  = sesión digital
```

El diseño anterior que reutilizaba el mismo PIN para kiosko y login operativo queda deprecado como arquitectura objetivo.

El código existente con `rrhh.fn_validar_acceso_operativo()` y `nombre_usuario + PIN` debe migrarse mediante nuevas migraciones; no modificar migraciones ya aplicadas.

Fuente detallada: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

---

# 5. Relación empleado → contrato → identidad → conductor

Las responsabilidades se separan así:

```text
RRHH EMPLEADO
   │
   ├── Expediente General
   │
   ├── Contrato activo
   │      └── PIN de asistencia
   │
   └── Identidad digital Nexo
          └── auth.users
                │
                └── roles/permisos
                      │
                      └── habilitación Transporte / conductor
```

## 5.1 Habilitación de conductor

Ser empleado no implica ser conductor.

```text
Empleado + contrato activo
      ↓
Habilitar conductor
      ↓
Crear/reutilizar identidad digital
      ↓
Asignar permisos Transporte
      ↓
Panel Conductor Web + Nexo Mobile
```

Si el empleado ya posee `auth.users`, no se crea otra cuenta.

`flotilla.conductores` es una extensión operacional y no una segunda persona.

---

# 6. Panel de Conductor Web

El Panel de Conductor es distinto de la administración de Transporte.

Acceso:

```text
usuario + contraseña
      ↓
Supabase Auth
      ↓
contrato activo
+ conductor habilitado
+ permisos
      ↓
Panel Conductor
```

Contenido operacional previsto:

- viaje actual;
- vehículo asignado;
- inspección;
- iniciar/continuar/finalizar viaje;
- incidencias;
- GPS/eventos;
- evidencia de entrega;
- historial;
- gastos/liquidación cuando aplique.

No se debe exponer administración de empleados, permisos, configuración global o administración de flota únicamente porque esas funciones existan en Nexo Web.

---

# 7. Nexo Mobile

Objetivo futuro:

```text
apps/mobile
```

Stack recomendado para spike técnico:

- React Native;
- Expo;
- TypeScript.

Nexo Mobile no es una WebView ni un espejo de la suite Web.

Es una superficie operacional que muestra únicamente los módulos y acciones aprobados para cada rol.

Primera vertical productiva: **Transporte / conductor**.

Capacidades nativas esperadas:

- Secure Storage;
- cámara;
- GPS;
- ubicación cuando el flujo lo requiera;
- offline-first;
- sincronización idempotente;
- push notifications;
- biometría como desbloqueo local opcional, nunca como autorización de backend.

La misma cuenta Supabase Auth debe funcionar en Panel de Conductor Web, Android e iOS.

---

# 8. Backend compartido para Web y Mobile

Toda lógica que deba existir en ambas superficies debe vivir en una capa compartida:

```text
Web ───────┐
           ├── RPC / servicio de dominio → PostgreSQL
Mobile ────┘
```

Evitar lógica crítica encerrada exclusivamente en Server Actions de Next.js.

Los Server Actions actúan como adaptadores Web; la autoridad de negocio y permisos debe quedar disponible para Mobile sin duplicación.

---

# 9. Offline-first

Prioridad:

1. Transporte — obligatorio.
2. Fabricación — deseable/operacional.
3. CRM — parcial.
4. RRHH — principalmente consulta/autoservicio; marcación móvil no se asume aprobada.

Toda escritura offline debe soportar:

- identificador idempotente;
- timestamp del dispositivo y servidor;
- estados pending/synced/failed;
- reintentos seguros;
- estrategia de conflictos;
- auditoría de origen.

---

# 10. Contrato laboral como autoridad operativa

Un contrato finalizado debe impedir nuevas operaciones laborales.

Ejemplos:

- PIN deja de marcar;
- conductor no inicia nuevos viajes;
- permisos/habilitaciones dependientes del contrato se revocan o suspenden;
- el historial no se borra.

Si el empleado deja de ser conductor pero conserva contrato activo:

- PIN de asistencia sigue vigente;
- otras funciones autorizadas pueden continuar;
- Transporte deja de autorizar nuevos viajes.

---

# 11. Seguridad

- contraseñas gestionadas por Supabase Auth;
- no guardar password/hash propio en tablas de negocio;
- PIN almacenado únicamente como hash de credencial de asistencia;
- no usar PIN como password temporal;
- no crear sesiones caseras paralelas;
- RLS y permisos validan cada operación aunque la UI la muestre;
- revocación backend prevalece sobre caché/estado local de Mobile.

La provisión de cuentas debe usar Admin SDK/API soportada por Supabase, nunca `INSERT` directo en `auth.users`.

---

# 12. Configuración efectiva conocida de Multi-Zones

Verificada en producción al 2026-09-04:

| Proyecto Vercel | App | Root Directory |
|---|---|---|
| `nexocore` | `apps/nexo` | `apps/nexo` |
| `nexo-crm` | `apps/crm` | `apps/crm` |
| `nexo-rrhh` | `apps/rrhh` | `apps/rrhh` |

Contrato de rutas actual:

```text
/crm      → CRM_APP_URL
/rrhh     → RRHH_APP_URL
```

`/rrhh/kiosco` sigue siendo una excepción deliberada al guard de sesión del usuario porque el kiosko autentica dispositivo + PIN, no una sesión personal.

---

# 13. Pendientes arquitectónicos

- [ ] Adaptar `apps/flotilla` a `nexo-core` y Multi-Zones.
- [ ] Refactorizar acceso operativo heredado de PIN doble propósito.
- [ ] Definir/provisionar identidad digital de empleados mediante Supabase Auth.
- [ ] Implementar Panel de Conductor Web sobre la identidad Nexo.
- [ ] Crear `apps/mobile` tras spike técnico.
- [ ] Completar `@nexo/supabase` y `@nexo/auth`.
- [ ] Pipeline CI/CD por app.
- [ ] Estrategia de versionado de paquetes compartidos.
- [ ] Distribución Android/iOS y gestión de versiones.

---

# 14. Fuentes relacionadas

- [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](PLAN_MAESTRO_IMPLEMENTACION_NEXO.md)
- [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
- [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md)
- [`DATABASE.md`](DATABASE.md)
- [`PERMISSIONS.md`](PERMISSIONS.md)
- [`planning/ARQUITECTURA_MVP_ESCALABLE.md`](planning/ARQUITECTURA_MVP_ESCALABLE.md)
