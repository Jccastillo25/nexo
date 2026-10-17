# Plan 15 — Nexo nativo en iPhone, Android y PC

> **Estado: aprobado por el usuario (2026-10-17)** — "Apruebo el plan: PC como
> PWA primero y Productos como primera vertical móvil".
> **En pausa, sin fecha (2026-10-17):** "La app y pc instalable aun no se
> hara". Ninguna fase (M0–M8) está en curso; no se empieza hasta que el
> usuario lo pida.
> Pedido original: "Necesitamos un plan para poder hacerla nativa en iPhone y
> Android y Pc" (2026-10-16).
> Amplía [02 — Estrategia móvil](02-estrategia-movil.md) y
> [10 — Fase 7 Mobile](10-fase7-mobile.md): agrega la PC y fija el orden real
> según el estado del backend. Cambio respecto de 02/10: la **primera vertical
> móvil pasa a ser Productos** (antes Transporte/conductor, que queda en M8
> porque depende de la Fase 4). Decisiones aún abiertas en §8.

---

## 1. Qué ya está decidido (no cambia)

- **Una sola app móvil, "Nexo Mobile"**, para Android e iOS, en `apps/mobile`,
  con **React Native + Expo + TypeScript**. Nada de WebView como arquitectura
  principal (plan 02 §4.1).
- **Mobile no replica la Web.** Es una superficie operacional por rol: muestra
  solo lo que cada persona hace en el campo o en el piso (plan 02 §4.2).
- **Un solo backend.** Web y Mobile llaman las mismas RPC de Postgres, y los
  permisos los decide siempre el servidor (`core.has_permission`) (plan 02 §4.3).
- **Mismo usuario y contraseña** que en la Web (Supabase Auth). La sesión se
  guarda cifrada en el teléfono. La biometría solo desbloquea localmente
  (plan 02 §4.4).

## 2. Estado real del backend (2026-10-16)

Lo que decide qué módulo puede ir primero al teléfono es si su lógica vive en
RPC (reutilizable) o en consultas directas desde la Web (no reutilizable tal
cual). Conteo en el código de `main`:

| Módulo | Llamadas RPC | Consultas directas a tablas | ¿Listo para móvil? |
|---|---:|---:|---|
| Productos | 17 | 0 | **Sí** |
| Atención | 26 | 0 | **Sí** |
| Panel Nexo (usuarios, roles, sucursales) | 32 | 0 | Sí (no se lleva a móvil) |
| Agencia | 3 | 0 | Sí (solo lectura) |
| RRHH | 14 | 66 | Parcial: el kiosco va por RPC; el expediente no |
| CRM | 3 | 8 | Parcial |
| Flotilla / Transporte | 0 | 117 | **No**: sigue en su Supabase original, sin adaptar |

Consecuencia: la primera vertical aprobada en el plan 02 (Transporte /
conductor) **depende de la Fase 4**, que todavía no empieza. Por eso el
§5 propone arrancar con módulos que ya están listos.

## 3. Arquitectura propuesta

```text
                 ┌──────────────── Supabase nexo-core ────────────────┐
                 │  Auth  ·  RPC public.<modulo>_*  ·  has_permission  │
                 └─────────────────────────▲──────────────────────────┘
                                           │ mismas RPC, mismos permisos
        ┌──────────────────────────────────┼──────────────────────────────┐
        │                                  │                              │
  Web (Next.js, Vercel)            Nexo Mobile (Expo)              Nexo Escritorio (PC)
  nexo.materialesjcastillo.com     iPhone + Android                Windows (y Mac)
  suite completa, administración   operacional por rol             = la Web instalada
```

### 3.1 iPhone y Android — `apps/mobile`

- Expo (SDK estable vigente al momento del spike) + Expo Router, con un build
  por plataforma vía **EAS Build** y actualizaciones de JS por **EAS Update**.
- Paquete compartido nuevo `packages/dominio`: tipos de las RPC (hoy en
  `apps/*/src/lib/tipos.ts`), códigos de permiso y formateadores. Lo usan la
  Web y Mobile; así una RPC cambia en un solo lugar.
- La UI **no se comparte**: React Native no usa el DOM. Se comparten los
  **tokens** (colores, tipografía Inter, espaciados) para que se vea como la
  misma suite.
- Sesión: `@supabase/supabase-js` con `expo-secure-store`. El cierre de sesión
  o la revocación de permisos en el servidor corta la siguiente operación
  aunque haya datos en caché.
- Funciones nativas por necesidad real: cámara (código de barras, fotos de
  evidencia), GPS (Transporte), notificaciones push (Atención), almacenamiento
  local SQLite para modo sin conexión.

### 3.2 PC — dos escalones

1. **Escalón 1: la Web instalable (PWA).** La suite ya funciona en el
   navegador de la PC. Se le agrega el manifiesto y el service worker, y queda
   como "aplicación" en Windows y Mac: ícono propio, ventana sin barra del
   navegador y acceso desde el menú Inicio. Costo bajo: días, no meses. No
   duplica código ni rompe las reglas de Multi-Zones ni de login único.
2. **Escalón 2 (solo si hace falta): Nexo Escritorio con Tauri.** Una app de
   escritorio liviana que abre la misma suite y agrega lo que el navegador no
   permite: impresora térmica o de etiquetas sin diálogo, lector de código de
   barras serial, balanza, cajón de dinero, actualizaciones automáticas e
   instalador firmado. Se decide cuando exista un caso concreto (Inventario,
   punto de venta, etiquetas de Productos).

**No se recomienda** compilar la app de Expo para Windows (react-native-windows):
duplicaría la administración web en una tecnología menos madura para
escritorio, y en la PC la gente necesita la suite completa, no la versión
operacional del teléfono.

## 4. Qué va en el teléfono (por rol)

| Rol | Pantallas en Nexo Mobile | Módulo fuente | Backend listo |
|---|---|---|---|
| Vendedor / mostrador | Buscar producto por nombre, código o **escaneando el código de barras**; ficha con unidad, marca y existencias (cuando exista Inventario); precio oficial (cuando exista Listas de precios) | Productos (+ Listas de precios) | Productos sí |
| Agente de atención | Iniciar/cerrar atención, fila en tiempo real, llamar al siguiente, aviso por **notificación push** | Atención | Sí |
| Empleado | Mi perfil, contrato, jornada, asistencia, comprobantes | RRHH (autoservicio) | Parcial (faltan RPC de lectura) |
| Conductor | Viaje actual, inspección, GPS, evidencia, incidencias, **sin conexión** | Transporte | No (Fase 4) |
| Vendedor de campo | Clientes, seguimiento | CRM | Parcial |

Administración (usuarios, roles, catálogos, importaciones, configuración)
queda solo en Web y PC.

## 5. Fases propuestas

| Fase | Entregable | Depende de | Duración estimada |
|---|---|---|---|
| **M0 — Decisiones y cuentas** | Aprobación de este plan (§8); cuentas Apple Developer y Google Play a nombre de la empresa; bundle ID `com.materialesjcastillo.nexo` (propuesto) | Usuario | 1 semana (trámites de Apple pueden tardar) |
| **M1 — PC instalable (PWA)** | Manifiesto + service worker en `apps/nexo` y en cada zona; ícono; instalable en Windows/Mac; verificación de que el login único sigue funcionando | Nada | 1 semana |
| **M2 — Spike móvil (NM-01)** | `apps/mobile` en el monorepo pnpm; login con Supabase; sesión segura; llamada a `has_permission` y a una RPC real (`productos_listar`); build en un iPhone y un Android físicos; CI que lo compile | M0 | 2 semanas |
| **M3 — Shell operacional (NM-02)** | Inicio según permisos del usuario, perfil, cerrar sesión, revocación, aviso de versión mínima, tokens visuales de la suite | M2 | 2 semanas |
| **M4 — Primera vertical: Productos en el bolsillo** | Búsqueda, escáner de código de barras, ficha; caché local de solo lectura para buscar sin señal | M3 + Productos importado | 2–3 semanas |
| **M5 — Atención móvil** | Puesto del agente con fila en tiempo real y push | M3 | 2–3 semanas |
| **M6 — Distribución (NM-07)** | Íconos, splash, textos de privacidad, permisos nativos explicados, TestFlight y Google Play (prueba interna), política de versiones | M4 | 1–2 semanas + revisión de tiendas |
| **M7 — RRHH autoservicio (NM-04)** | Primero convertir sus lecturas a RPC; luego pantallas | RPC de RRHH | Por estimar |
| **M8 — Transporte conductor (NM-03)** | Offline-first con sincronización idempotente | Fase 4 (adaptar Flotilla) | Por estimar |
| **PC escalón 2 (Tauri)** | Solo si aparece un caso de hardware | Caso concreto aprobado | Por estimar |

Las duraciones son orientativas para una persona con Claude Code. Se
recalculan después de M2.

## 6. Reglas que se mantienen y lo que cambia en el repo

- **Paso Cero sigue igual.** Una pantalla móvil nueva usa los mismos códigos
  de permiso que la Web. Si una acción solo existe en móvil, primero se diseña
  y aprueba su permiso.
- **Toda lógica que use Mobile va en RPC** (regla de `CLAUDE.md`). Un Server
  Action de Next.js no sirve para el teléfono.
- **CI:** `apps/mobile` declara `typecheck`, `lint` y `build`. Para Mobile,
  `build` es la exportación de Expo, no un binario. Los binarios firmados los
  hace EAS fuera de Vercel. Vercel no despliega `apps/mobile`.
- **Lockfile:** Expo entra al mismo `pnpm-lock.yaml`. Se valida en el spike que
  la instalación con `--frozen-lockfile` siga pasando en Vercel para las demás
  apps.
- **Documentación:** al aprobarse, este archivo pasa a ser parte del Plan
  Maestro. Se actualizan 02, 10, `ARCHITECTURE.md` §7, `ROADMAP.md` y
  `MODULES.md`.

## 7. Costos fijos conocidos

| Concepto | Costo aproximado |
|---|---|
| Apple Developer Program (organización) | USD 99 por año; requiere número D-U-N-S de la empresa |
| Google Play Console | USD 25, pago único |
| Expo EAS | Plan gratuito para empezar; plan pago si se necesitan más builds al mes |
| Certificado de firma de código para Windows (solo PC escalón 2) | Variable según proveedor; no hace falta para la PWA |

## 8. Decisiones

Tomadas (2026-10-17):

1. **PC:** PWA primero; Tauri solo si aparece un caso de hardware. ✅
2. **Primera vertical móvil:** Productos (vendedor/mostrador con escáner). ✅

Abiertas (se resuelven en M0):

3. **¿A nombre de quién van las cuentas de Apple y Google?** Se propone Grupo
   CT o Materiales J Castillo. Apple exige D-U-N-S para cuentas de empresa.
4. **¿Qué teléfonos se usan hoy?** Proporción iPhone/Android y versiones
   mínimas. Decide qué se prueba primero.
5. **Prioridad frente a lo pendiente en Web:** importación real de Productos,
   Listas de precios y piloto de RRHH. ¿Mobile va en paralelo o después?
