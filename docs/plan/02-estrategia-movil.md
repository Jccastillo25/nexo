# Plan Maestro — Estrategia móvil Android + iOS

> Parte de [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](../PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) (índice). Misma vigencia y jerarquía que el documento madre.

---

# 4. Estrategia móvil — Android + iOS

## 4.1 Una sola app: Nexo Mobile

Objetivo:

```text
apps/
├── nexo
├── rrhh
├── crm
├── flotilla
├── inventario        futuro
├── fabricacion       futuro
└── mobile            Android/iOS
```

Stack recomendado para spike técnico: **React Native + Expo + TypeScript**.

No usar WebView como arquitectura principal.

## 4.2 Mobile no replica Web

Mobile es una superficie operacional.

Ejemplo para conductor:

```text
NEXO MOBILE
├── Viaje actual
├── Mi vehículo
├── Inspección
├── Iniciar/continuar/finalizar viaje
├── GPS
├── Incidencias
├── Evidencia de entrega
├── Mis viajes
├── Liquidación
└── Perfil
```

No incluir por defecto:

- administración de empleados;
- planillas administrativas;
- permisos;
- configuración global;
- administración completa de flota;
- CRM completo;
- funciones que no correspondan al rol móvil.

## 4.3 Backend compartido

```text
Web ───────┐
           ├── RPC / servicio de dominio → PostgreSQL
Mobile ────┘
```

La lógica crítica reutilizable no puede existir solo dentro de una Server Action Web.

## 4.4 Seguridad móvil

- Supabase Auth;
- sesión en almacenamiento seguro de Android/iOS;
- biometría solo como desbloqueo local opcional;
- permisos del backend siempre autoritativos;
- revocaciones deben invalidar nuevas operaciones aunque exista caché local.

## 4.5 Offline-first

Prioridad:

1. Transporte — obligatorio.
2. Fabricación — deseable/operacional.
3. CRM — parcial.
4. RRHH — principalmente consulta/autoservicio; marcación móvil no se asume aprobada.

Toda escritura offline requiere idempotencia, reintentos, timestamp de cliente/servidor, estado de sincronización, estrategia de conflictos y auditoría.
