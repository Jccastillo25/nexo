# wiki/ — esquema y convenciones

Esta carpeta es una **wiki técnica persistente** sobre el propio proyecto Ruta360, mantenida
por Claude. No es documentación estática que alguien escribe una vez: cada vez que hay una
fuente nueva (una migración, una decisión del usuario, un commit, un artículo externo), Claude
la lee, la integra en las páginas existentes, y deja un registro. La wiki crece y se corrige a
sí misma con el tiempo — nunca se re-deriva desde cero en cada pregunta.

Referencia del patrón completo (por qué existe esto, filosofía): pregúntale al usuario o revisa
el historial de conversación — el patrón se llama "LLM Wiki" y separa tres capas: fuentes
crudas, wiki generada, y este esquema.

## Relación con `docs/`

`docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/ROADMAP.md` y `docs/README.md` son la
**referencia técnica estable** del proyecto — completa, pero reescrita a mano de golpe cada vez
(sin historial de decisiones, sin trazabilidad a fuentes). Existió un primer intento
(`docs/01_Requisitos/`, `02_Arquitectura/`, `03_Agentes/`, `04_Tareas/`, `99_Recursos/`) de
reorganizar esa documentación al estilo wiki, pero quedó mayormente vacío o desactualizado
(extraído del PDF original, sin reflejar el sistema real) y nunca se versionó en git; el usuario
pidió eliminarlo el 2026-08-22 y ya no existe en el repo.

**Esta wiki (`wiki/`) es donde vive el conocimiento vivo de aquí en adelante.** No borres ni
reescribas `docs/` sin que el usuario lo pida explícitamente — si detectas que algo en `docs/`
quedó obsoleto respecto a lo que dice `wiki/`, anótalo como hallazgo de lint (ver abajo) y
pregúntale al usuario qué hacer, no lo cambies solo.

## Las tres capas

### 1. `wiki/sources/` — fuentes crudas (inmutables)

Un archivo markdown por fuente ingerida. **Nunca se edita un source después de creado** — si la
fuente cambió (ej. una migración se corrigió), se crea un nuevo source, no se sobrescribe el
viejo. Cada source es un registro de metadata + lo relevante que aportó, no necesariamente una
copia del archivo original si este ya vive en el repo (una migración SQL, un commit, un PDF) —
en ese caso el source apunta a la ruta real con un link relativo.

Frontmatter de un source:

```yaml
---
type: source
date: 2026-01-15          # fecha en que se ingirió (no la fecha del contenido original)
kind: migration | commit | pdf | conversation | external-article | code
ref: supabase/migrations/0012_split_users_into_admins_and_drivers.sql   # ruta o URL real, si aplica
---
```

Cuerpo libre: qué es, qué decisiones o datos clave aportó, y qué páginas de `wiki/pages/`
actualizó o creó. Nombre de archivo: `AAAA-MM-DD-slug-descriptivo.md`.

### 2. `wiki/pages/` — la wiki (propiedad de Claude)

Markdown interlinkado con wikilinks de Obsidian (`[[nombre-de-pagina]]`, sin carpeta ni
extensión — Obsidian resuelve por nombre corto). **Regla de nombres:** cada archivo dentro de
`wiki/pages/` debe tener un nombre base único en toda la wiki (aunque estén en subcarpetas
distintas), para que `[[wikilinks]]` no sean ambiguos.

Subcarpetas:

- `pages/entities/` — una página por tabla o grupo de tablas fuertemente relacionadas del
  esquema de datos (ej. `drivers.md`, `trips.md`). Qué es, columnas relevantes, RLS, quién la
  escribe, a qué otras entidades se conecta.
- `pages/concepts/` — decisiones de arquitectura o de negocio transversales (ej.
  `modelo-de-roles-y-aislamiento.md`, `gestion-por-excepcion.md`). El porqué, no solo el qué.
- `pages/modules/` — una página por área funcional de la app (ej. `panel-admin.md`,
  `driver-app.md`). Qué hace, rutas, componentes clave, qué conceptos/entidades usa.
- `pages/overview.md` — punto de entrada: los tres niveles del sistema, stack, mapa de la wiki.
- `pages/roadmap.md` — línea de tiempo de qué se construyó, en qué orden, y qué falta. Se
  actualiza en cada ingest relevante, no se reescribe de cero.

Frontmatter de una página:

```yaml
---
type: entity | concept | module | overview | roadmap
updated: 2026-01-15
sources: [[[2026-01-15-migracion-0012-split-admins-drivers]]]   # wikilinks a wiki/sources/
---
```

Cada página cierra con una sección `## Fuentes` listando los sources que la originaron o
actualizaron, en orden cronológico.

### 3. `wiki/index.md` y `wiki/log.md`

Ver más abajo — son especiales, no van dentro de `pages/`.

## Flujos de trabajo

### Ingest (agregar una fuente nueva)

1. Crear el archivo en `wiki/sources/` con su frontmatter y resumen.
2. Identificar qué páginas de `wiki/pages/` toca (nuevas o existentes). Una fuente típica toca
   entre 1 y 6 páginas — no hace falta tocar todo.
3. Para cada página: si no existe, crearla; si existe, **integrar**, no anexar sin criterio —
   actualizar cifras/decisiones que cambiaron, señalar explícitamente si la fuente nueva
   contradice algo que la página decía antes (no borrar la versión vieja en silencio: dejar
   una nota corta de qué cambió y por qué, o quitarla si ya no aporta valor histórico).
4. Actualizar `wiki/index.md` (páginas nuevas, o resumen si cambió sustancialmente).
5. Añadir una entrada a `wiki/log.md`.
6. Si el usuario está presente en la conversación, resumir en el chat qué se integró antes de
   seguir — no hace falta para ingests triviales o en lote.

### Query (responder una pregunta contra la wiki)

1. Leer `wiki/index.md` primero para ubicar páginas relevantes — no releer todos los sources.
2. Abrir solo las páginas que hacen falta y, si la pregunta lo exige, el source original citado
   en `## Fuentes` para confirmar un dato puntual.
3. Responder con síntesis + citas a las páginas usadas.
4. Si la respuesta es genuinamente nueva (una comparación, un análisis que no existía como
   página), ofrecer archivarla como página nueva en `wiki/pages/` en vez de dejarla solo en el
   chat.

### Lint (mantenimiento periódico)

Cuando el usuario pida un chequeo de salud de la wiki, o tras un lote grande de cambios en el
código real:

- Buscar contradicciones entre páginas.
- Buscar afirmaciones desactualizadas por una fuente más reciente (comparar contra
  `git log`, migraciones nuevas en `supabase/migrations/`, o el estado real del código).
- Páginas huérfanas (sin enlaces entrantes) o conceptos mencionados en varias páginas que
  todavía no tienen su propia página.
- Reportar hallazgos al usuario antes de corregir en bloque, salvo correcciones triviales
  (fechas, rutas de archivo movidas).

## Convención de `index.md`

Catálogo por categoría (Overview, Roadmap, Conceptos, Entidades, Módulos), cada entrada como:

```markdown
- [[nombre-de-pagina]] — una línea de qué es. _(actualizado AAAA-MM-DD)_
```

## Convención de `log.md`

Append-only, entradas más nuevas al final. Cada entrada empieza con un encabezado de nivel 2 con
prefijo fijo para que sea `grep`-able:

```markdown
## [2026-01-15] ingest | Migración 0012 — split admins/drivers
## [2026-01-20] query | Comparación PIN vs contraseña
## [2026-02-01] lint | Revisión de páginas post Fase 2
```

Debajo del encabezado, 2-4 líneas: qué se hizo, qué páginas se tocaron.

## Idioma y estilo

Todo en español (igual que el resto del repo y `docs/`). Directo, sin relleno. Preferir tablas
para datos estructurados (columnas, RLS) y prosa corta para el porqué de una decisión.
