# Plan Maestro — Objetivo, arquitectura base y superficies de acceso

> Parte de [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](../PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) (índice). Misma vigencia y jerarquía que el documento madre — leer esta nota solo reemplaza la lectura íntegra del monolito anterior, no cambia ninguna regla.

---

# 1. Objetivo de Nexo

Nexo será una suite empresarial modular con backend común, identidad centralizada, permisos unificados y flujos conectados.

```text
CRM
 ↓
Pedido
 ↓
Inventario ── hay existencia ──────────────┐
 ↓                                         │
requiere fabricar                         │
 ↓                                         │
Fabricación                                │
 ↓                                         │
Producto terminado ────────────────────────┘
 ↓
Transporte
 ↓
Entrega / evidencia
 ↓
CRM actualizado
```

RRHH participa transversalmente:

```text
RRHH
├── Expediente General
├── Expediente Laboral / contratos
├── PIN de asistencia
├── jornadas
├── asistencia
├── planillas
└── identidad/habilitación laboral para módulos operativos
```

---

# 2. Arquitectura base que se conserva

- monorepo Turborepo + pnpm;
- una app Next.js Web por módulo en `apps/*`;
- un proyecto Vercel por app Web;
- dominio Web único `nexo.materialesjcastillo.com`;
- Multi-Zones con rewrites desde `apps/nexo`;
- un Supabase `nexo-core`;
- un schema PostgreSQL por módulo;
- `core` como capa neutral de permisos/integraciones;
- Supabase Auth como identidad digital;
- RLS y DENY-BY-DEFAULT;
- `core.fn_*`/RPC para operaciones atómicas cross-schema.

No migrar a microservicios sin una necesidad real que justifique perder transacciones simples dentro del mismo Postgres.

---

# 3. Tres superficies de acceso

```text
                    NEXO
                      │
        ┌─────────────┼─────────────┐
        │             │             │
  WEB ADMINISTRATIVO  KIOSKO     CONDUCTOR
       NEXO           RRHH       WEB + APP
        │              │            │
   SSO / Auth       SOLO PIN    USUARIO +
                                CONTRASEÑA
```

## 3.1 Web administrativo

- sesión Supabase Auth;
- acceso a módulos según permisos;
- administración de RRHH, CRM, Transporte, etc.;
- no comparte la credencial PIN del kiosko.

## 3.2 Kiosko RRHH

- dispositivo autorizado;
- empleado introduce únicamente PIN;
- backend valida contrato activo;
- determina entrada/salida según secuencia cuando sea inequívoco;
- registra asistencia;
- no crea una sesión Supabase Auth del empleado.

## 3.3 Panel de Conductor Web + Nexo Mobile

- usuario + contraseña;
- Supabase Auth;
- `auth.uid()` + permisos + RLS;
- contrato activo;
- habilitación como conductor;
- misma cuenta para Web, Android e iOS.
