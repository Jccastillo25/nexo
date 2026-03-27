# ⚡ CHEAT SHEET: HABILIDADES DE CLAUDE

**Referencia rápida de 1 página** - Guarda en bookmark para acceso rápido

---

## 🎯 DECISIÓN RÁPIDA: ¿QUÉ HABILIDAD USAR?

```
┌─ TIENES CÓDIGO ────────────────────────────────────────────┐
│                                                             │
│ ¿Es para MERGEAR? (PR importante, cambios críticos)       │
│   └─ /engineering:code-review                              │
│                                                             │
│ ¿NO FUNCIONA? (Error, comportamiento inesperado)          │
│   └─ /engineering:debug                                    │
│                                                             │
│ ¿ESTÁ FALTA? (Props drilling, queries N+1, performance)   │
│   └─ /engineering:code-review + /system-design             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─ TIENES UNA IDEA ──────────────────────────────────────────┐
│                                                             │
│ ¿NUEVA FEATURE? (Diseño, arquitectura, trade-offs)        │
│   └─ /engineering:system-design                            │
│                                                             │
│ ¿DECISIÓN IMPORTANTE? (Tecnología, enfoque)               │
│   └─ /engineering:architecture                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─ TIENES UNA TAREA ─────────────────────────────────────────┐
│                                                             │
│ ¿DOCUMENTAR? (ADR, runbook, API docs)                     │
│   └─ /engineering:documentation                            │
│                                                             │
│ ¿ANALYZAR DATOS? (Metrics, performance, reports)          │
│   └─ /xlsx                                                 │
│                                                             │
│ ¿PRE-DEPLOY? (Verificación antes de ir a prod)           │
│   └─ /engineering:deploy-checklist                         │
│                                                             │
│ ¿REFACTORIZAR? (Qué mejorar primero)                      │
│   └─ /engineering:tech-debt                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 TEMPLATES RÁPIDOS

### CODE REVIEW
```
@Claude /engineering:code-review

**Contexto:** [1 línea qué y por qué]
**Código:** [pegar aquí]
**Revisar:**
- ¿Seguridad?
- ¿Performance?
- ¿[Tu preocupación específica]?
```

### DEBUG
```
@Claude /engineering:debug

**Error:** [mensaje exacto del error]
**Stack:** [pegar]
**Contexto:** Prod/Local, intermitente sí/no
**Pasos:** 1. ... 2. ... 3. ...
```

### SYSTEM DESIGN
```
@Claude /engineering:system-design

**Requerimiento:** [qué necesitas]
**Scale:** [máx usuarios/events]
**Constraints:** [qué no puedes cambiar]
**Options:** [opciones consideradas]
```

### DOCUMENTATION
```
@Claude /engineering:documentation

**Documento:** [ADR/Runbook/API Docs]
**Audience:** [quién lo lee]
**Incluir:**
- [Sección 1]
- [Sección 2]
```

---

## 🚀 EJEMPLOS REALES PARA TU PROYECTO

### Revisar RLS Policy
```
@Claude /engineering:code-review

**Context:** RLS policy para supervisores ven empleados logs
**Code:** [SQL RLS policy]
**Check:**
- ¿Hay N+1 en la subquery?
- ¿Faltan índices?
- ¿Seguridad OK?
```

### Debuggear Realtime Subscription
```
@Claude /engineering:debug

**Error:** "subscription already exists" en useAttendanceRealtime
**Stack:** [copy from console]
**Context:** Production (Vercel), no intermitente
**Repro:** 1. Ir dashboard 2. Refresh
```

### Diseñar Notificaciones RT
```
@Claude /engineering:system-design

**Req:** Notificaciones cuando empleado marca asistencia
**Scale:** 10k emp, 500 events/min
**Constraints:** Sin nueva infra (solo Supabase)
**Options:** 1. Realtime 2. SSE 3. WebSockets custom
```

### Pre-Deploy de Índices
```
@Claude /engineering:deploy-checklist

**Change:** Agregar 2 índices PostgreSQL
**Files:** supabase/migrations/...sql
**Database:** Vercel production
**Rollback:** DROP INDEX scripts listos
**Monitor:** Query times en get_monthly_top_delays
```

---

## 📊 QUICK STATS

| Skill | Triggers | Time/Use | Frequency |
|-------|----------|----------|-----------|
| code-review | "review", PR, merge | 5-10 min | 3-4x/week |
| debug | error, "doesn't work" | 10-20 min | 2-3x/week |
| system-design | "how should", feature | 30-45 min | 1-2x/week |
| documentation | "doc", "write", "runbook" | 15-20 min | 1-2x/week |
| deploy-checklist | pre-deploy, migrations | 10-15 min | 2x/week |
| tech-debt | "refactor", quality | 20-30 min | 2x/month |
| xlsx | data, metrics, reports | 15-30 min | 1-2x/month |

---

## ☝️ PRO TIPS

✅ **Sé específico:**
- "Revisar N+1 en esta query" vs "revisar código"

✅ **Da contexto:**
- Stack, environment, constraint, expected behavior

✅ **Proporciona todo:**
- Código exacto, no descripciones

✅ **Pregunta claramente:**
- "¿Hay vulnerabilidad RLS?" vs "¿está bien?"

✅ **Di qué esperas:**
- "Debería tardar 200ms, tarda 4.2s en prod"

---

## 🔗 ARCHIVOS COMPLETOS

Para más detalles, abre:

| Necesidad | Archivo |
|-----------|---------|
| Overview completo | REPORTE_HABILIDADES_CLAUDE.md |
| Todos los templates | PROMPTS_OPTIMIZADOS.md |
| Nuevas skills | NUEVAS_SKILLS_PROPUESTAS.md |
| Workflow | README_HABILIDADES.md |
| Resumen visual | RESUMEN_VISUAL.txt |

---

## 💡 WORKFLOW TÍPICO

```
1. Escribo código localmente
         ↓
2. /code-review → ¿Está bien?
    ├─ Sí → Mergear
    └─ No → Arreglar
         ↓
3. Si hay bug → /debug
         ↓
4. /documentation → Documenta decisión
         ↓
5. /deploy-checklist → ¿Listo para prod?
```

---

## 🎯 TU PRIMER PASO

**Ahora mismo:**

1. Abre un archivo con código
2. Copia el template de CODE-REVIEW
3. Pégalo aquí:
```
@Claude /engineering:code-review
[pega template + tu código]
```
4. ¡Envía!

---

## ❓ PREGUNTAS FRECUENTES

**P: ¿Necesito permisos especiales?**
A: No, todos los skills ya están activos. Usa `/skill-name` directamente.

**P: ¿Cuánto tarda cada skill?**
A: Depende, pero típicamente 5-45 min. Ver tabla QUICK STATS.

**P: ¿Qué pasa si me equivoco en el prompt?**
A: Pregúntame aclaraciones. Mejor pedir que asumir.

**P: ¿Qué son las nuevas skills propuestas?**
A: 3 skills adicionales para optimizar tareas de Supabase/Next.js.
Opcional crear, pero recomendado (Ver NUEVAS_SKILLS_PROPUESTAS.md).

---

**Última actualización:** 2026-03-26
**Stack:** Next.js 16 + React 19 + TypeScript + Supabase
**Proyecto:** marcacion-grupo-ct
