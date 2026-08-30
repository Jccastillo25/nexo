# Plan de Unificación — "Nexo" (estilo Odoo)

Fecha: 2026-08-29
Autor: Claude Code (sesión de reingeniería)
Estado: Propuesta para validación — ningún cambio ejecutado todavía

## 0. Objetivo

Unificar Gestor360 (RRHH/marcación), Ruta360 (transporte) y materiales-jcastillo
(web + CRM) en **un solo repositorio**,
con **un panel central estilo Odoo** donde el usuario elige el módulo/app al que
quiere entrar, autenticación única, y un modelo de permisos y base de datos
consistente entre módulos.

---

## 1. Diagnóstico (inventario real, 2026-08-29)

| # | Producto | Repo actual | Carpeta local | Backend | Dominio prod |
|---|---|---|---|---|---|
| 1 | Gestor360 | `jcaatillo/marcacion-grupo-ct` | no clonado localmente | Supabase `ofeuzkwjhmfsazqfyutu` | (interno Grupo CT) |
| 2 | Ruta360 | `Jccastillo25/transporte-saas` | `Desktop/Transporte` | Supabase (proyecto propio) | `transporte.materialesjcastillo.com` |
| 3 | materiales-jcastillo (web+CRM) | `Jccastillo25/materiales-jcastillo` | `Desktop/jcastillo/WEB Corporativo jcastillo` | Supabase `arzadwxsifnaolvfcvqk` | pendiente |

Puntos relevantes que ya existen y hay que **conservar, no reinventar**:

- `materiales-jcastillo` ya usa el patrón correcto: un repo, `apps/*`, cada app
  desplegada como proyecto Vercel independiente apuntando a su subcarpeta.
  Ese es el patrón de despliegue que vamos a generalizar a todo Nexo.
- Gestor360 ya tiene una **norma de permisos DENY-BY-DEFAULT** (6 dominios:
  Centro de Control, Talento, Turnos, Asistencia, Nómina, Sistema) vinculada a
  `user_permissions`. Esa norma se **extiende** (no se reemplaza) para cubrir
  también qué módulos ve cada usuario en el panel central.
- Ruta360 ya es multi-tenant (empresa → flota → admins/conductores).

---

## 2. Arquitectura objetivo

### 2.1 Decisión de despliegue: monorepo + apps independientes (recomendado)

Se descartan dos extremos:

- ❌ **Repos separados como hoy**: no hay panel único, no hay permisos
  compartidos, cada fix de "componente compartido" se duplica 3 veces
  (ya está pasando: Gestor360 tiene 3 implementaciones de `StatCard`).
- ❌ **Un solo Next.js monolítico con todo adentro**: obliga a reescribir
  Gestor360 y Ruta360 desde cero, alto riesgo sobre apps en producción,
  builds lentos, un bug en un módulo puede tumbar el resto.

✅ **Recomendado**: **monorepo (Turborepo + pnpm workspaces)** con una app
por módulo, cada una desplegada como proyecto Vercel independiente
(Root Directory = subcarpeta) — igual que ya haces en `materiales-jcastillo`.

**Corrección de arquitectura (2026-08-29):** el usuario pidió que esto se
sienta como Odoo de verdad — Odoo no usa un subdominio por módulo, usa
**un solo dominio de app** (`mycompany.odoo.com`) con los módulos como
rutas (`/odoo/inventory`, `/odoo/crm`). Para lograr eso sin fusionar el
código de RRHH/Flotilla/CRM en una sola app (que sí sería el rewrite de
alto riesgo que descartamos arriba), usamos el patrón oficial de Next.js
**Multi-Zones**:

- Un dominio único para toda la suite: **`nexo.materialesjcastillo.com`**.
- La app `nexo` (la "zona raíz") define en su `next.config.js` un
  `rewrite` por módulo: `/rrhh/:path*` → URL de despliegue de `apps/rrhh`,
  `/flotilla/:path*` → URL de despliegue de `apps/flotilla`, etc.
- Cada módulo configura `basePath: '/rrhh'` (o el que corresponda) para
  que sus rutas y assets vivan bajo ese prefijo.
- El usuario nunca ve la URL real de cada deploy — solo
  `nexo.materialesjcastillo.com/rrhh`, `/flotilla`, `/crm`.
- Como todo es un solo host, la sesión de Supabase Auth es una cookie
  normal de ese dominio: **no hace falta ningún truco de cookie
  compartida entre subdominios**, se resuelve solo.
- Se conservan los despliegues independientes por módulo (cada uno su
  propio proyecto Vercel, su propio pipeline, su propio rollback) — la
  migración sigue siendo incremental, *strangler fig*, sin big-bang.

Fuente: [Next.js — Guides: Multi-Zones](https://nextjs.org/docs/pages/guides/multi-zones), [Vercel KB — múltiples proyectos bajo un dominio](https://vercel.com/kb/guide/how-can-i-serve-multiple-projects-under-a-single-domain).

Ver [PROPUESTA_MARCA_MODULOS.md](PROPUESTA_MARCA_MODULOS.md) para el naming
completo (suite **Nexo**, módulos sin número: RRHH, Flotilla, CRM...), el
mapa de rutas, y la convención de manifest por módulo (inspirada en
`__manifest__.py` de Odoo).

Esto permite migrar módulo por módulo (patrón *strangler fig*) sin parar
producción, y mantener el pipeline de Vercel que ya conoces.

### 2.2 Decisión de base de datos: un solo proyecto Supabase, con schema por módulo

✅ **Recomendado**: un proyecto Supabase nuevo, `nexo-core`, con:

- `auth.users` — identidad única para todos los módulos (SSO real).
- schema `core` — compañías, perfiles, **registro de apps/módulos**,
  permisos unificados, auditoría.
- schema `rrhh` — todas las tablas actuales de Gestor360, migradas tal cual (el módulo se renombra a **RRHH**).
- schema `flotilla` — todas las tablas actuales de Ruta360 (el módulo se renombra a **Flotilla**).
- schema `crm` — tablas del CRM de materiales-jcastillo.

Cada schema mantiene su propio RLS, pero todas las políticas validan contra
`core.user_permissions` y `core.companies`, igual que ya exige tu norma de
permisos en Gestor360 — solo que ahora es una norma **de suite**, no por app.

Por qué un solo proyecto y no varios con "puente": Supabase no soporta auth
compartida entre proyectos de forma nativa. Para lograr el "un login, todo
accesible" de Odoo, la identidad tiene que vivir en un solo Postgres. Los
schemas namespaced evitan colisiones de nombres de tabla y permiten migrar
cada módulo sin tocar los otros.

---

## 3. Estructura de repo propuesta

```
nexo/                          # nuevo repo único (o renombrar uno existente)
├── apps/
│   ├── nexo/                    # Panel central estilo Odoo (selector de apps)
│   ├── rrhh/                    # ex marcacion-grupo-ct/web (Gestor360)
│   ├── flotilla/                # ex Desktop/Transporte (Ruta360)
│   ├── crm/                    # ex WEB Corporativo jcastillo/apps/crm
│   └── web-corporativo/        # ex WEB Corporativo jcastillo/apps/web
├── packages/
│   ├── ui/                     # design system compartido (StatCard, PageHeader, etc.)
│   ├── auth/                   # cliente Supabase Auth + hooks de sesión compartida
│   ├── supabase/               # clients tipados por schema, tipos generados
│   ├── permissions/            # motor de permisos único (extensión de la norma v2.0)
│   ├── config/                 # eslint, tsconfig, tailwind compartidos
│   └── types/                  # tipos compartidos entre apps
├── supabase/
│   ├── migrations/             # migraciones versionadas, prefijadas por schema
│   └── seed/
├── docs/
│   ├── README.md                # índice
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── MODULES.md                # catálogo de módulos y su estado
│   ├── PERMISSIONS.md            # norma de permisos v3.0 (suite completa)
│   ├── MIGRATION_LOG.md          # bitácora viva de la migración (por fase)
│   └── ROADMAP.md
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 4. Modelo de datos del núcleo (`core`)

Tablas nuevas mínimas para que el panel funcione estilo Odoo:

- `core.companies` — ya existe el concepto en Gestor360 y Ruta360; se convierte
  en la tabla única de "empresa/tenant" que referencian todos los schemas.
- `core.apps` — catálogo de módulos instalables: `id, slug, nombre, icono,
  ruta, categoria, activo`. Esto es literalmente el "menú de apps" de Odoo;
  se sincroniza automáticamente desde el `manifest.json` de cada módulo
  (ver [PROPUESTA_MARCA_MODULOS.md](PROPUESTA_MARCA_MODULOS.md) sección 5).
- `core.user_permissions` — extensión de la tabla actual de Gestor360:
  se añade una columna `module_id → core.apps` para que un permiso quede
  ligado a "qué puede hacer" **dentro de** "en qué módulo". Sigue siendo
  DENY BY DEFAULT.
- `core.company_apps` — qué módulos tiene contratados/activos cada empresa
  (para clientes que no deben ver todos los módulos, ej. un cliente de
  Flotilla no debe ver RRHH).
- `core.audit_log` — auditoría unificada (hoy cada app probablemente audita
  por su cuenta).
- `core.migration_map` — tabla temporal: `schema_origen, id_original,
  id_nuevo, migrado_en` para trazabilidad durante el corte de cada módulo.

**Norma de permisos v3.0** (extiende la norma de permisos v2.0 de Gestor360,
documentada en `docs/PERMISSIONS.md` de este repo):
se agrega un 7º dominio, **"Módulos"**, que controla qué apps aparecen en el
panel central para cada usuario/empresa. El panel `nexo` nunca hardcodea qué
apps mostrar: siempre lee `core.company_apps` + `core.user_permissions`.

---

## 5. Plan de migración de bases de datos (paso a paso)

1. **Provisionar** el proyecto Supabase nuevo `nexo-core` (no tocar los
   proyectos actuales todavía — cero riesgo sobre producción).
2. **Exportar schema** de cada proyecto actual (`supabase db dump --schema
   public`) y reescribirlo para vivir bajo su schema namespaced
   (`rrhh`, `flotilla`, `crm`), ajustando FKs que hoy apuntan a
   `auth.users`/`public.companies` para que apunten a `core.*`.
3. **Migrar datos** con `pg_dump`/`pg_restore` o scripts de copia por tabla,
   registrando cada fila migrada en `core.migration_map`.
4. **Reconciliar usuarios**: cruzar `auth.users` de los 3 proyectos por email;
   si una persona existe en más de un sistema (ej. un admin que usa Gestor360
   y también ve el CRM), debe quedar como **un solo** `auth.users` en
   `nexo-core` con permisos en ambos módulos.
5. **Regenerar RLS** en cada schema migrado, ahora validando contra
   `core.user_permissions` en vez de contra su propia tabla de permisos local.
6. **Congelar en solo-lectura** el proyecto Supabase de origen del módulo
   que se está cortando, validar el módulo nuevo en `nexo-core` en paralelo
   una semana, y recién ahí apagar (pausar, no borrar) el proyecto viejo.

Orden de corte recomendado (de menor a mayor riesgo):

1. `web-corporativo` (sin datos transaccionales, bajo riesgo)
2. `crm` (Supabase `arzadwxsifnaolvfcvqk`, tráfico bajo, aún "Fase 2")
3. `flotilla` (ex Ruta360, producción activa pero con volumen menor)
4. `rrhh` (ex Gestor360, producción crítica + trabajo de permisos en curso:
   migrar de último, cuando la norma v3.0 ya esté probada en los otros tres)

---

## 6. Plan de desarrollo del panel (`nexo`)

- Next.js nuevo, es la **zona raíz** de Multi-Zones, desplegada en
  `nexo.materialesjcastillo.com` (ver
  [PROPUESTA_MARCA_MODULOS.md](PROPUESTA_MARCA_MODULOS.md) sección 3).
- Pantalla de login única (Supabase Auth) → redirige al panel (`/`).
- Panel = grilla de tarjetas/íconos, una por módulo activo para esa empresa
  y ese usuario (lee `core.apps` + `core.company_apps` +
  `core.user_permissions`), igual que el launcher de Odoo. Nombres de módulo
  clásicos y sin número (RRHH, Flotilla, CRM), un ícono Lucide por tarjeta.
- Cada tarjeta enlaza a la ruta de su módulo (`/rrhh`, `/flotilla`, `/crm`),
  resuelta por el `rewrite` de Multi-Zones hacia el deploy real de esa app;
  la sesión ya está activa (una sola cookie, un solo dominio), sin pedir
  login de nuevo.
- Componentes de `packages/ui` (StatCard, PageHeader) se construyen una sola
  vez aquí y se reutilizan — resuelve directamente el pendiente UX que ya
  tenías anotado en Gestor360 (3 StatCard distintos, tema claro/oscuro mezclado).

---

## 7. Documentación (qué se crea/actualiza)

| Documento | Contenido | Vive en |
|---|---|---|
| `README.md` (raíz) | Qué es Nexo, cómo levantar el monorepo, mapa de apps | raíz del repo |
| `docs/ARCHITECTURE.md` | Stack, monorepo, modelo de despliegue, SSO | `docs/` |
| `docs/DATABASE.md` | Schemas, RLS, convención de nombres, cómo migrar una tabla nueva | `docs/` |
| `docs/PERMISSIONS.md` | Norma v3.0 completa (7 dominios), cómo registrar un permiso nuevo | `docs/` |
| `docs/MODULES.md` | Catálogo de módulos, estado (activo/en migración/planeado), owner | `docs/` |
| `docs/MIGRATION_LOG.md` | Bitácora fecha a fecha de qué se migró, qué falta, rollback notes | `docs/` |
| `docs/ROADMAP.md` | Fases futuras, nuevos módulos | `docs/` |
| `CLAUDE.md` por app | Convenciones específicas de cada módulo (ya existe en Transporte) | `apps/<modulo>/` |

Cada README de app existente (`Ruta360/docs/*`, `apps/crm/README.md`) se
conserva y se referencia desde `docs/MODULES.md`, no se reescribe desde cero.

---

## 8. Fases y cronograma sugerido

| Fase | Contenido | Duración estimada |
|---|---|---|
| 0 | Confirmar decisiones (nombre de la suite, dominio, Supabase org) | 1-2 días |
| 1 | Crear repo monorepo, Turborepo, packages compartidos vacíos | 2-3 días |
| 2 | Provisionar `nexo-core`, tabla `core.*`, permisos v3.0 | 3-4 días |
| 3 | Migrar `web-corporativo` + `crm` al monorepo y a `nexo-core` | 1 semana |
| 4 | Construir `nexo` (panel) funcional sobre los 2 módulos ya migrados | 1 semana |
| 5 | Migrar `ruta360` (app + datos), validar en paralelo, cortar | 1-2 semanas |
| 6 | Migrar `gestor360` (app + datos), validar en paralelo, cortar | 2-3 semanas |
| 7 | Apagar proyectos Supabase/repos viejos (pausar, no borrar) | 1 semana después del corte |
| 8 | Documentación final + retiro de dominios/redirects viejos | 2-3 días |

Total aproximado: **7-9 semanas** trabajando de forma incremental sin parar
ninguna app en producción.

---

## 9. Riesgos y mitigaciones

- **Colisión de usuarios por email entre sistemas** → reconciliar manualmente
  antes de cortar cada módulo, tabla `core.migration_map` como respaldo.
- **RLS mal migrado expone datos entre empresas** → correr `get_advisors`
  de Supabase después de cada migración de schema, antes de habilitar tráfico real.
- **Regresión de permisos** (algo que antes estaba bloqueado queda abierto)
  → migrar Gestor360 al final, cuando la norma v3.0 ya se validó en 3 módulos
  más simples.
- **Vercel: builds cruzados** → usar `turbo-ignore` en cada proyecto Vercel
  para que un cambio en `apps/flotilla` no dispare rebuild de `apps/crm`.
- **Multi-Zones: colisión de rutas** → Next.js exige que las rutas sean
  únicas entre zonas; cada módulo debe fijar su `basePath` exacto
  (`/rrhh`, `/flotilla`...) y el CI valida que no se repita ningún prefijo
  antes de mergear.
- **Desalineación de versión del design system entre zonas** → como cada
  módulo es un deploy independiente, un módulo puede quedar usando una
  versión vieja de `packages/ui`; mitigar con Changesets/versionado
  explícito de los packages compartidos y CI que bloquea merges con
  versión desfasada.
- **Downtime en el corte** → mantener el proyecto Supabase viejo en
  solo-lectura (no pausado) durante la semana de validación paralela, para
  poder revertir sin pérdida de datos si algo falla.

---

## 10. Próximos pasos inmediatos

1. ~~Confirmar nombre de la suite~~ → **Nexo** (decidido, ver
   [PROPUESTA_MARCA_MODULOS.md](PROPUESTA_MARCA_MODULOS.md)).
2. Confirmar: ¿repo nuevo desde cero, o se reutiliza `materiales-jcastillo`
   como base (ya tiene la estructura `apps/*` correcta)?
3. Crear el proyecto Supabase `nexo-core` y las tablas de `core.*`.
4. Empezar por el módulo de menor riesgo (`web-corporativo`) como piloto del
   patrón completo (monorepo + panel Nexo + schema namespaced) antes de tocar
   RRHH o Flotilla.
