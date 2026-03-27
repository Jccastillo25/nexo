# 📊 REPORTE DE HABILIDADES INSTALADAS Y OPTIMIZACIÓN

**Fecha:** 2026-03-26
**Usuario:** Julio Castillo
**Proyecto:** marcacion-grupo-ct (v0.2.0)
**Contexto:** Full-stack Next.js 16 + React 19 + TypeScript + Supabase

---

## 1. HABILIDADES ACTUALMENTE INSTALADAS

### ✅ Habilidades de Documentos (Document Creation)
| Habilidad | Descripción | Triggers | Estado |
|-----------|-------------|----------|--------|
| **docx** | Creación/edición de documentos Word con formato profesional | Reportes, memos, templates, Word docs | ✅ Activa |
| **xlsx** | Manejo de spreadsheets (Excel, CSV, TSV) | Datos tabulares, budgets, análisis | ✅ Activa |
| **pdf** | Procesamiento de PDFs (merge, split, OCR, formularios) | PDFs, forms, documentos | ✅ Activa |
| **pptx** | Creación y edición de presentaciones | Slides, decks, pitch decks | ✅ Activa |

### ✅ Habilidades de Ingeniería (Engineering)
| Habilidad | Descripción | Triggers | Estado |
|-----------|-------------|----------|--------|
| **engineering:architecture** | ADRs, decisiones de diseño, trade-offs | "Design a system for", componentes | ✅ Activa |
| **engineering:code-review** | Revisión de código, seguridad, performance | PRs, diffs, "review this" | ✅ Activa |
| **engineering:debug** | Debugging estructurado, diagnóstico | Errores, stack traces, "doesn't work" | ✅ Activa |
| **engineering:documentation** | Docs técnicas, READMEs, runbooks | "Write docs for", "document this" | ✅ Activa |
| **engineering:deploy-checklist** | Verificación pre-deploy, rollback | Releases, migrations, feature flags | ✅ Activa |
| **engineering:incident-response** | Respuesta a incidentes, postmortems | "We have an incident", prod down | ✅ Activa |
| **engineering:standup** | Resúmenes de standup, actividad reciente | Daily standup, commit summary | ✅ Activa |
| **engineering:system-design** | Diseño de sistemas, APIs, data models | "Design a system", arquitectura | ✅ Activa |
| **engineering:tech-debt** | Auditoría de tech debt, refactoring | "Tech debt", "code health" | ✅ Activa |
| **engineering:testing-strategy** | Estrategias de testing, test plans | "How should we test", test coverage | ✅ Activa |

### ✅ Habilidades de Automatización
| Habilidad | Descripción | Triggers | Estado |
|-----------|-------------|----------|--------|
| **schedule** | Crear tareas programadas automáticas | Cron jobs, scheduled runs | ✅ Activa |
| **skill-creator** | Crear/optimizar skills, evals, benchmarks | "Create a skill", optimize prompts | ✅ Activa |

### ✅ Habilidades de Plugins
| Habilidad | Descripción | Triggers | Estado |
|-----------|-------------|----------|--------|
| **cowork-plugin-management:cowork-plugin-customizer** | Customizar plugins para equipos | "Customize plugin", setup | ✅ Activa |
| **cowork-plugin-management:create-cowork-plugin** | Crear plugins desde cero | "Create a plugin", scaffold | ✅ Activa |

---

## 2. ANÁLISIS: ALINEACIÓN CON TU PERFIL

### 🎯 Fortalezas Actuales
**Perfecto para tu flujo de trabajo:**
- ✅ **Documentación técnica** → `engineering:documentation` cubre tu necesidad de ADRs y runbooks
- ✅ **Code review** → `engineering:code-review` para auditar cambios antes de merge
- ✅ **Debugging** → `engineering:debug` para diagnósticos de TypeScript/Supabase
- ✅ **Automatización** → `schedule` para tareas cron (monitoreo, reportes)
- ✅ **Data analysis** → `xlsx` para análisis de logs/metrics del proyecto

### ⚠️ Brechas Identificadas

Tu proyecto tiene necesidades muy específicas que **no están completamente cubiertas:**

1. **Testing en Supabase/RLS** → Necesitas estrategia de testing específica para RLS + RPCs
2. **Performance monitoring** → No hay skill para análisis de queries PostgreSQL
3. **Vercel deploys** → Tienes integración con Vercel pero no hay skill específica
4. **TypeScript/Next.js patterns** → No hay skill para refactoring específico del stack
5. **Database migrations** → No hay skill para versionado de migrations en Supabase

---

## 3. PROMPTS EXACTOS PARA USAR MIS HABILIDADES

### 📋 Cuando Quieras Usar Code Review
```
@Claude /engineering:code-review
Revisar esta PR que añade RLS a la tabla de logs.
¿Hay vulnerabilidades en la política de fila?
¿La performance está optimizada (indices)?
```

### 🐛 Cuando Haya un Bug
```
@Claude /engineering:debug
Error en useAttendanceRealtime: "subscription already exists"
Stack trace: [pegar aquí]
Reproduces en: Production (Vercel)
Staging: No
```

### 📚 Cuando Necesites Documentar
```
@Claude /engineering:documentation
Crear runbook para: "Cómo agregar un nuevo tipo de evento a la tabla de logs"
Incluir:
- Schema changes
- RLS policies a actualizar
- Ejemplos de uso
```

### 🏗️ Cuando Diseñes una Característica
```
@Claude /engineering:system-design
Queremos agregar notificaciones en tiempo real a través de Realtime.
Constrains:
- Máx 10k empleados
- 500 eventos/minuto
¿Qué arquitectura propones?
```

### ⚙️ Cuando Prepares un Deploy
```
@Claude /engineering:deploy-checklist
Voy a mergear: "Añadir 2 nuevos indices PostgreSQL"
Database: Supabase (ofeuzkwjhmfsazqfyutu)
Environment: Production
¿Qué debo verificar antes?
```

### 📊 Para Análisis de Performance
```
@Claude /xlsx
Crear spreadsheet con análisis de:
- Query times (promedio por RPC)
- Índices más usados
- Gaps en cobertura de índices
```

---

## 4. NUEVAS HABILIDADES A CREAR

Basado en tu stack y preferencias, te recomiendo crear estas 3 skills nuevas:

### 🆕 Skill 1: **supabase-optimization**
**Propósito:** Auditar y optimizar queries, RPCs, RLS policies en Supabase
**Triggers:**
- "Audit this RPC"
- "Optimize this query"
- "Check my RLS policy"
- "Analyze Supabase performance"

**Acciones:**
- Revisar queries para N+1
- Sugerir índices
- Validar RLS correctness
- Proponer RPCs para batching

**Prompt exacto:**
```
Analizar la siguiente query/RPC en Supabase:
[código]

Revisar:
1. ¿Hay N+1 queries o unbounded fetches?
2. ¿Faltan índices? ¿Cuáles?
3. ¿La RLS policy es segura y eficiente?
4. ¿Se puede batching con un RPC?
5. Proponer optimización paso a paso
```

---

### 🆕 Skill 2: **nextjs-refactor**
**Propósito:** Refactoring específico de Next.js 16 App Router + Server Actions
**Triggers:**
- "Refactor this component"
- "Optimize Server Actions"
- "Review my RSC strategy"
- "Convert to Server Component"

**Acciones:**
- Convertir componentes a RSC cuando apropiado
- Optimizar Server Actions
- Identificar props drilling innecesario
- Sugerir patrones de caché

**Prompt exacto:**
```
Refactorizar siguiente código Next.js 16 para mejor performance:
[código]

Considera:
1. ¿Debería ser Server Component en lugar de Client?
2. ¿Este Server Action puede batching?
3. ¿Hay oportunidades de caché?
4. ¿Props drilling innecesario?
5. Proponer cambios mínimos, máximo impacto
```

---

### 🆕 Skill 3: **test-supabase-rls**
**Propósito:** Estrategia de testing para RLS policies + RPCs
**Triggers:**
- "Test this RLS policy"
- "Write RLS tests"
- "How to test Supabase permissions"
- "RLS test strategy"

**Acciones:**
- Generar test cases para cada RLS policy
- Sugerir mocking de Supabase en tests
- Verificar cobertura de edge cases
- Proponer estructura de test helpers

**Prompt exacto:**
```
Crear estrategia de testing para esta RLS policy:
[SQL de RLS]

Proporcionar:
1. Test cases para casos válidos + inválidos
2. Cómo mockear Supabase en Jest
3. Edge cases a considerar
4. Test helpers reutilizables
5. Script de CI/CD para run
```

---

## 5. CÓMO USAR ESTE REPORTE

### Opción A: Usa mis habilidades existentes (HOY)
Cuando necesites ayuda, usa estos comandos exactos:
```bash
# Para revisar código
/engineering:code-review

# Para debuggear
/engineering:debug

# Para diseñar
/engineering:system-design

# Para documentar
/engineering:documentation
```

### Opción B: Crea las nuevas skills (ESTA SEMANA)
Quisiera que me pidas crear las 3 nuevas skills:
```
Claude, crea las siguientes skills:
1. supabase-optimization
2. nextjs-refactor
3. test-supabase-rls

Usa los prompts del reporte como base.
```

---

## 6. TU VENTAJA: MIS CARACTERÍSTICAS ESPECIALES

Tienes acceso a MCPs (Model Context Protocols) que amplifican mis habilidades:

| MCP | Capacidad | Para Tu Proyecto |
|-----|-----------|------------------|
| **Supabase** | Ejecutar SQL, crear migraciones, generar types | Acceso directo a DB |
| **Vercel** | Check deployments, read logs, view runtime logs | Monitorear prod |
| **Git/GitHub** | Read commits, PRs, branches | Análisis de cambios |
| **Google Drive** | Buscar docs, leer specs internas | Documentación de equipo |
| **ClickUp** | Listar tareas, agregar comentarios | Integración con workflow |

---

## 7. RESUMEN & NEXT STEPS

### 📌 Hoy Mismo Puedes:
1. Usar `/engineering:code-review` antes de mergear
2. Usar `/engineering:debug` cuando tengas errores
3. Usar `/engineering:documentation` para ADRs
4. Usar `/xlsx` para analizar metrics

### 📌 Esta Semana:
1. **Decidir** si crear las 3 nuevas skills
2. **Crear** `supabase-optimization` (más urgente)
3. **Documentar** RLS policies actuales

### 📌 Información Útil:
- **Supabase project:** `ofeuzkwjhmfsazqfyutu` (marcacion-grupo-ct)
- **Stack:** Next.js 16, React 19, TypeScript, Supabase PostgreSQL
- **Vercel:** Deployment automático en cada push a `main`
- **Tus preferencias:** Apply changes directly, no pedir permiso cada paso

---

**¿Qué deseas hacer ahora?**
- ✅ Usar habilidades existentes (quiero que empieces con X tarea)
- ✅ Crear nuevas skills (vamos a crear supabase-optimization)
- ✅ Profundizar en alguna habilidad específica
