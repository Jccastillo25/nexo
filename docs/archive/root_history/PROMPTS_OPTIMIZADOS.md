# 🎯 PROMPTS OPTIMIZADOS PARA CADA HABILIDAD

**Propósito:** Referencia rápida de prompts exactos para sacar máximo provecho de mis habilidades

---

## 1. ENGINEERING: CODE REVIEW

### Cuándo Usarlo
- Antes de mergear PR importante
- Code que toca RLS, RPCs, o lógica crítica
- Sospechas vulnerabilidades o performance issues

### Prompt Template (COPIA Y USA)

```
@Claude /engineering:code-review

Revisar el siguiente cambio:

**Contexto:**
- Afecta: [cuál tabla/componente/API]
- Razón: [qué problema resuelve]
- Risk level: [low/medium/high]

**Código:**
[pegar código aquí]

**Específicamente revisar:**
1. [Tu preocupación específica 1]
2. [Tu preocupación específica 2]
3. [Tu preocupación específica 3]

**Stack reminder:**
- Next.js 16 App Router
- Supabase RLS + RPCs
- TypeScript 5
- Vercel deployment
```

### Ejemplos Reales (Para Tu Proyecto)

#### Ejemplo A: Revisar nueva RLS policy
```
@Claude /engineering:code-review

Revisar el siguiente cambio a RLS en tabla attendance_logs:

**Contexto:**
- Tabla: attendance_logs
- Cambio: Permitir que supervisores vean logs de sus empleados
- Risk level: high (seguridad)

**SQL:**
```sql
CREATE POLICY "supervisors_can_view_their_employees_logs" ON attendance_logs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT supervisor_id FROM employees
      WHERE employee_id = attendance_logs.employee_id
    )
  );
```

**Específicamente revisar:**
1. ¿Esta subquery es eficiente o causa N+1?
2. ¿Hay edge cases de seguridad (admin bypasses)?
3. ¿Debería haber un índice nuevo?
```

#### Ejemplo B: Revisar Server Action
```
@Claude /engineering:code-review

Revisar este Server Action para clock-in:

**Contexto:**
- Archivo: app/api/actions/clock-in.ts
- Cambio: Añadir validación de geolocation
- Risk level: medium

**Código:**
[pegar getClockInAction()]

**Específicamente revisar:**
1. ¿Hay race condition si dos requests llegan simultáneamente?
2. ¿La validación de PIN es segura (timing attacks)?
3. ¿Se puede optimizar las queries?
```

---

## 2. ENGINEERING: DEBUG

### Cuándo Usarlo
- Hay un error que no entiendes
- Algo funciona en local pero no en prod
- Comportamiento inesperado sin error visible

### Prompt Template (COPIA Y USA)

```
@Claude /engineering:debug

**Error/Issue:**
[Descripción de qué está mal]

**Stack Trace:**
[Pegar aquí]

**Contexto:**
- Ambiente: [local/staging/production]
- ¿Es intermitente? [sí/no]
- ¿Cuándo empezó? [fecha/commit]
- ¿Qué cambió recientemente? [describe cambios]

**Reproducción:**
Pasos exactos para reproducir:
1. [paso 1]
2. [paso 2]
3. [paso 3]

**Ya intenté:**
- [cosa 1]
- [cosa 2]

**Pistas:**
[Cualquier otra información útil]
```

### Ejemplos Reales

#### Ejemplo A: Subscription error en Realtime
```
@Claude /engineering:debug

**Error/Issue:**
useAttendanceRealtime throws "subscription already exists"
cuando hago refresh en dashboard

**Stack Trace:**
```
Error: Subscription exists
at RealtimeClient.subscribe (realtime.ts:145)
at useAttendanceRealtime (hooks/useAttendanceRealtime.ts:28)
```

**Contexto:**
- Ambiente: Production
- Es intermitente: No, siempre pasa
- Cuándo empezó: Después de actualizar @supabase/supabase-js a v2.45.0
- Qué cambió: Migramos de useEffect a useMemo

**Reproducción:**
1. Ir a dashboard
2. Abrir DevTools (network + console)
3. Refresh página
4. Ver error

**Ya intenté:**
- Agregar cleanup en useEffect
- Hacer unsubscribe explícito

**Pistas:**
El error solo aparece en producción (Vercel),
no en local
```

#### Ejemplo B: Query performance
```
@Claude /engineering:debug

**Error/Issue:**
Dashboard tarda 5+ segundos en cargar los datos de asistencia

**Contexto:**
- Ambiente: Production
- Es intermitente: Sí, solo en horarios pico
- Cuándo empezó: Después de agregar 5 índices nuevos
- Qué cambió: Refactorizamos RPCs

**Reproducción:**
1. Ir a dashboard
2. Abrir Network tab
3. Ver request a get_monthly_top_delays RPC
4. Tardó 4.2 segundos

**Ya intenté:**
- Revisar índices con EXPLAIN
- Agregar LIMIT a queries

**Pistas:**
En staging anda bien (pocos datos)
En prod lento (10k+ empleados)
```

---

## 3. ENGINEERING: SYSTEM DESIGN

### Cuándo Usarlo
- Planificar una característica nueva grande
- Decidir entre arquitecturas
- Pensar en scalability

### Prompt Template (COPIA Y USA)

```
@Claude /engineering:system-design

**Requerimiento:**
[Qué necesitas hacer]

**Constraints:**
- Scale: [máx usuarios/requests]
- Latency: [SLA]
- Disponibilidad: [99.9%, 99.99%]
- Budget: [si aplica]

**Contexto Actual:**
- Architecture: [tu stack actual]
- Data volume: [GB/TB]
- Growth: [% por mes]

**Opciones Consideradas:**
1. [Opción A]
2. [Opción B]
3. [Opción C]

**Preguntas Específicas:**
- [Tu duda 1]
- [Tu duda 2]

**Restricciones Técnicas:**
- No podemos cambiar [X]
- Tenemos experiencia en [Y]
```

### Ejemplo Real: Notificaciones en Tiempo Real

```
@Claude /engineering:system-design

**Requerimiento:**
Enviar notificaciones en tiempo real cuando un empleado marca asistencia
(para supervisores y admins)

**Constraints:**
- Scale: 10k empleados máx, 500 eventos/minuto pico
- Latency: <500ms desde evento hasta notificación
- Disponibilidad: 99.9%

**Contexto Actual:**
- Architecture: Next.js 16 + Supabase
- Actualmente usamos: Supabase Realtime para subscripciones
- Base de datos: PostgreSQL 17 con RLS

**Opciones Consideradas:**
1. Realtime de Supabase (ya tenemos)
2. WebSockets custom en Next.js
3. Server-Sent Events (SSE)

**Preguntas Específicas:**
- ¿Realtime es suficiente para 500 eventos/min?
- ¿Necesitamos persistencia si un usuario está offline?
- ¿Cómo escalamos si crecemos a 50k empleados?

**Restricciones Técnicas:**
- No queremos agregar infra nueva (Redis, Kafka)
- Preferimos usar lo que ya tenemos en Supabase
```

---

## 4. ENGINEERING: DOCUMENTATION

### Cuándo Usarlo
- Documentar ADRs de decisiones importantes
- Crear runbooks para operaciones
- Documentar API o arquitectura

### Prompt Template (COPIA Y USA)

```
@Claude /engineering:documentation

**Documento a crear:**
[ADR / Runbook / API Docs / etc]

**Contexto:**
- Propósito: [qué necesita esta documentación]
- Audience: [quién la va a leer]
- Nivel técnico: [junior/mid/senior]

**Contenido Requerido:**
- [Sección 1]
- [Sección 2]
- [Sección 3]

**Ejemplos a Incluir:**
[Si aplica]

**Preferencias de Formato:**
- [Markdown/HTML/Slides]
- [Con/sin diagramas]
```

### Ejemplo Real: Runbook de RLS

```
@Claude /engineering:documentation

**Documento a crear:**
Runbook: "Cómo agregar una RLS policy nueva"

**Contexto:**
- Propósito: Guía step-by-step para developers
- Audience: Junior-mid developers del equipo
- Nivel técnico: Conocen SQL básico

**Contenido Requerido:**
1. Conceptos: Qué es RLS y por qué la usamos
2. Checklist: Pasos para crear una nueva policy
3. Testing: Cómo verificar que funciona
4. Common mistakes: Errores típicos
5. Debugging: Cómo debuggear si falla

**Ejemplos a Incluir:**
- Ejemplo de RLS policy simple (SELECT)
- Ejemplo de RLS policy compleja (UPDATE con validaciones)
- Cómo testear con psql

**Preferencias de Formato:**
- Markdown (para guardar en repo)
- Con ejemplos de SQL inline
```

---

## 5. ENGINEERING: DEPLOY CHECKLIST

### Cuándo Usarlo
- Antes de mergear a `main` (que va auto a prod)
- Cambios con database migrations
- Cambios que tocan RLS o infraestructura

### Prompt Template (COPIA Y USA)

```
@Claude /engineering:deploy-checklist

**Cambio a deployar:**
[Descripción breve]

**Tipo:**
[Feature / Bugfix / Refactor / Migration]

**Archivos Afectados:**
- [Archivo 1]
- [Archivo 2]

**Database Changes:**
- [Migration A]
- [Migration B]
- (o "Ninguno")

**Environment:**
- Staging: [sí/no]
- Production: [Vercel]

**Rollback Plan:**
[Cómo revertir si algo sale mal]

**Monitoring:**
¿Qué métricas/logs chequeamos post-deploy?
```

### Ejemplo Real: Deployment de Índices

```
@Claude /engineering:deploy-checklist

**Cambio a deployar:**
Agregar 2 nuevos índices PostgreSQL para performance

**Tipo:**
Performance optimization

**Archivos Afectados:**
- supabase/migrations/20260326_add_indexes.sql

**Database Changes:**
- Migration: idx_attendance_logs_employee_status_created_at
- Migration: idx_break_logs_employee_date

**Environment:**
- Staging: ✅ (testeado 4 horas)
- Production: Vercel

**Rollback Plan:**
```sql
DROP INDEX IF EXISTS idx_attendance_logs_employee_status_created_at;
DROP INDEX IF EXISTS idx_break_logs_employee_date;
```

**Monitoring:**
Post-deploy chequear:
- Query times en get_monthly_top_delays RPC (debe bajar)
- Database CPU usage (no debe subir)
- Error logs (buscar "index" errors)
```

---

## 6. ENGINEERING: TECH DEBT

### Cuándo Usarlo
- Revisar qué se debe refactorizar
- Priorizar qué arreglar primero
- Planificar sprints de limpieza técnica

### Prompt Template (COPIA Y USA)

```
@Claude /engineering:tech-debt

**Audit Context:**
[Qué parte de la app estás revisando]

**Known Issues:**
- [Issue 1 que ya conoces]
- [Issue 2]

**Time Constraint:**
¿Cuánto tiempo tienes para revisar?
[1 hour / 1 day / 1 week]

**Priority Guide:**
¿Qué es más importante?
1. [Criterio A]
2. [Criterio B]
3. [Criterio C]

**Deliverable:**
¿Qué formato quieres?
[Priorized list / Spreadsheet / Documento detallado]
```

### Ejemplo Real: Tech Debt en Realtime

```
@Claude /engineering:tech-debt

**Audit Context:**
Hooks de Realtime (useAttendanceRealtime, useEmployeeStatusRealtime)

**Known Issues:**
- Múltiples listeners creando subscriptions duplicadas
- useMemo trata de stabilizarlos pero falta cleanup a veces
- Queries no batching en algunos casos

**Time Constraint:**
2-3 horas de revisión

**Priority Guide:**
1. Seguridad (data leaks, RLS bypasses)
2. Performance (queries, subscriptions)
3. Maintainability (código feo pero funciona)

**Deliverable:**
Spreadsheet con:
- Issue
- Severity
- Estimated effort
- Propuesta de fix
```

---

## 7. XLSX: ANALYSIS & DATA

### Cuándo Usarlo
- Analizar metrics de performance
- Crear reports de datos
- Compilar datos para decisiones

### Prompt Template (COPIA Y USA)

```
@Claude /xlsx

**Objetivo:**
[Qué análisis necesitas]

**Datos Source:**
- [De dónde vienen los datos]
- [CSV, JSON, manual entry, query results]

**Columnas/Métricas:**
- [Métrica 1]
- [Métrica 2]
- [Métrica 3]

**Análisis Deseado:**
- [Tipo 1: Trend, Pivot, Comparison]
- [Tipo 2]

**Visualización:**
¿Quieres gráficos?
- [Tipo A: Line chart, Bar, Heatmap]

**Output Format:**
Nombre archivo: [nombre.xlsx]
```

### Ejemplo Real: Performance Analysis

```
@Claude /xlsx

**Objetivo:**
Analizar performance de RPCs post-optimización

**Datos Source:**
Query results de Supabase query stats (últimas 2 semanas)

**Columnas/Métricas:**
- RPC name
- Promedio query time (ms)
- P95 latency
- Calls por día
- Error rate

**Análisis Deseado:**
- Comparar antes/después de índices nuevos
- Identificar outliers
- Top 5 slowest RPCs

**Visualización:**
- Line chart: Query time trend por día
- Bar chart: RPCs ordenados por speed
- Heatmap: Performance by hour of day

**Output Format:**
performance_analysis_20260326.xlsx
```

---

## 8. PPTX: PRESENTATIONS

### Cuándo Usarlo
- Presentar avance de proyecto
- Reportes ejecutivos
- Demo decks

### Prompt Template (COPIA Y USA)

```
@Claude /pptx

**Objetivo:**
[Qué es la presentación]

**Audience:**
[Quién la va a ver]

**Contenido:**
1. [Slide 1 - Title]
2. [Slide 2 - Body]
...

**Tone:**
[Professional / Casual / Technical / Executive]

**Visual Style:**
[Minimalist / Colorful / Dark mode / Corporate]

**Time Limit:**
[5 min / 10 min / 15 min]
```

### Ejemplo Real: Quarterly Review

```
@Claude /pptx

**Objetivo:**
Presentar progreso Q1 2026 a stakeholders

**Audience:**
Directivos (CTO, CEO, Product leads)

**Contenido:**
1. Slide de título: marcacion-grupo-ct Q1 Review
2. Roadmap cumplido vs planeado
3. Metrics key: Users, performance, uptime
4. Tech improvements (índices, RPCs, optimizations)
5. Próximas prioridades Q2
6. Riesgos y mitigaciones

**Tone:**
Professional pero conversacional

**Visual Style:**
Dark mode con colores brand

**Time Limit:**
10 minutos
```

---

## 9. QUICK REFERENCE: CUÁNDO USAR CADA SKILL

| Necesidad | Skill a Usar | Comando |
|-----------|-------------|---------|
| Revisar PR antes de mergear | code-review | `/engineering:code-review` |
| Arreglar un bug | debug | `/engineering:debug` |
| Diseñar feature nueva | system-design | `/engineering:system-design` |
| Documentar decisión | documentation | `/engineering:documentation` |
| Pre-deploy checklist | deploy-checklist | `/engineering:deploy-checklist` |
| Identificar qué refactorizar | tech-debt | `/engineering:tech-debt` |
| Crear spreadsheet de datos | xlsx | `/xlsx` |
| Crear presentación | pptx | `/pptx` |
| Crear documento Word | docx | `/docx` |
| Procesar PDF | pdf | `/pdf` |

---

## 10. TEMPLATE: CÓMO PEDIRME AYUDA

Copia este template y modifica según necesites:

```
@Claude /[skill-name]

**Contexto:**
[Información de contexto]

**Problema/Necesidad:**
[Qué necesitas exactamente]

**Restricciones:**
- [Constraint 1]
- [Constraint 2]

**Información Técnica:**
- Stack: Next.js 16, React 19, TypeScript, Supabase
- Proyecto: marcacion-grupo-ct
- [Otra info relevante]

**Deliverable Esperado:**
[Qué tipo de output esperas]

**Detalles Específicos:**
[Cualquier otra cosa que sea importante]
```

---

**¿Listo para empezar? Usa cualquiera de estos prompts ahora mismo.**
