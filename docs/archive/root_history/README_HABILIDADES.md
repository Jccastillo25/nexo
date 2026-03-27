# 🎯 GUÍA RÁPIDA: HABILIDADES DE CLAUDE PARA TU PROYECTO

**Última actualización:** 2026-03-26
**Proyecto:** marcacion-grupo-ct (v0.2.0)
**Usuario:** Julio Castillo

---

## 📚 DOCUMENTOS DISPONIBLES

Acabamos de generar **3 documentos completos**. Aquí está qué leer según tu necesidad:

### 1️⃣ **REPORTE_HABILIDADES_CLAUDE.md** ← EMPIEZA AQUÍ
**¿Qué es?** Inventario completo de mis 14 skills instaladas + análisis de brechas
**Cuándo leer:** Ahora mismo, toma 5-10 min
**Secciones:**
- Tabla de todas las habilidades disponibles
- Análisis: qué está bien, qué falta
- Prompts recomendados para cada skill
- Resumen final con recomendaciones

**Acción recomendada:** Lee la sección 4 (Nuevas Habilidades a Crear)

---

### 2️⃣ **PROMPTS_OPTIMIZADOS.md** ← USA ESTO PARA PEDIR AYUDA
**¿Qué es?** Colección de templates y prompts exactos listos para copiar/pegar
**Cuándo usar:** Cada vez que necesites algo de mí
**Secciones:**
- Prompt template para cada skill (code-review, debug, etc)
- Ejemplos reales para tu proyecto
- Quick reference table
- Template universal para cualquier tarea

**Acción recomendada:** Guarda esta referencia. Úsala cada vez que me pidas ayuda.

---

### 3️⃣ **NUEVAS_SKILLS_PROPUESTAS.md** ← OPCIONAL (MÁS IMPACTO)
**¿Qué es?** Detalles de las 3 nuevas skills que recomiendo crear
**Cuándo leer:** Si quieres optimizar aún más (tiempo: 2-3 horas de setup)
**Secciones:**
- Descripción detallada de cada skill
- Casos de uso específicos
- Estructura y triggers
- Ejemplos completos de ejecución

**Acción recomendada:** Lee después de 2-3 semanas usando las skills existentes.

---

## ⚡ INICIO RÁPIDO

### HOY: USA SKILLS EXISTENTES

#### Si quieres revisar código (PR, RLS, Server Action):
```
@Claude /engineering:code-review
[pega tu código aquí]
```
👉 Ve a **PROMPTS_OPTIMIZADOS.md** Sección 1

---

#### Si tienes un bug:
```
@Claude /engineering:debug
[describe qué está pasando]
```
👉 Ve a **PROMPTS_OPTIMIZADOS.md** Sección 2

---

#### Si quieres optimizar algo:
```
@Claude /engineering:system-design
[describe lo que quieres]
```
👉 Ve a **PROMPTS_OPTIMIZADOS.md** Sección 3

---

#### Si necesitas documentar:
```
@Claude /engineering:documentation
[qué documentar]
```
👉 Ve a **PROMPTS_OPTIMIZADOS.md** Sección 4

---

### ESTA SEMANA: PLANIFICA NUEVAS SKILLS

Lee **NUEVAS_SKILLS_PROPUESTAS.md** y elige:
- ✅ Crear las 3 skills nuevas (recomendado)
- ✅ Esperar y ver si necesitas realmente
- ✅ Crear solo `supabase-optimizer` (mayor impacto)

---

## 🗺️ MAPA MENTAL: CUÁNDO USAR CADA HABILIDAD

```
¿Qué necesitas hacer?
│
├─ Revisar código/PR/cambios?
│  └─ /engineering:code-review
│     → PROMPTS_OPTIMIZADOS.md #1
│
├─ Arreglar un bug/error?
│  └─ /engineering:debug
│     → PROMPTS_OPTIMIZADOS.md #2
│
├─ Diseñar una feature nueva?
│  └─ /engineering:system-design
│     → PROMPTS_OPTIMIZADOS.md #3
│
├─ Documentar algo?
│  └─ /engineering:documentation
│     → PROMPTS_OPTIMIZADOS.md #4
│
├─ Pre-deploy checklist?
│  └─ /engineering:deploy-checklist
│     → PROMPTS_OPTIMIZADOS.md #5
│
├─ Identificar tech debt?
│  └─ /engineering:tech-debt
│     → PROMPTS_OPTIMIZADOS.md #6
│
├─ Crear spreadsheet de datos?
│  └─ /xlsx
│     → PROMPTS_OPTIMIZADOS.md #7
│
├─ Crear presentación?
│  └─ /pptx
│     → PROMPTS_OPTIMIZADOS.md #8
│
└─ Tareas específicas de Supabase?
   └─ NUEVA SKILL: supabase-optimizer
      → NUEVAS_SKILLS_PROPUESTAS.md #1
```

---

## 📊 LAS 5 HABILIDADES QUE MÁS USARÁS

| Rank | Skill | Frecuencia | Tiempo Ahorrado | Ver |
|------|-------|-----------|-----------------|-----|
| 1️⃣ | code-review | 3-4x/semana | 30 min/uso | PROMPTS #1 |
| 2️⃣ | debug | 2-3x/semana | 45 min/uso | PROMPTS #2 |
| 3️⃣ | system-design | 1-2x/semana | 2 horas/uso | PROMPTS #3 |
| 4️⃣ | documentation | 1-2x/semana | 1 hora/uso | PROMPTS #4 |
| 5️⃣ | deploy-checklist | 2x/semana | 15 min/uso | PROMPTS #5 |

**Total ahorrado por semana:** ~6-8 horas

---

## 🎯 TU WORKFLOW ÓPTIMO

### Flujo típico de una tarea:

```
1. PLANEACIÓN
   /engineering:system-design
   → "¿Cómo debería implementar X?"

2. CODIFICACIÓN
   Escribes el código localmente

3. REVIEW PRE-MERGE
   /engineering:code-review
   → "¿Hay problemas antes de mergear?"

4. RESOLUCIÓN (si hay bugs)
   /engineering:debug
   → "¿Por qué esto no funciona?"

5. DOCUMENTACIÓN
   /engineering:documentation
   → "Documenta esta decisión"

6. DEPLOY
   /engineering:deploy-checklist
   → "¿Qué validar antes de prod?"

7. MONITOREO (opcional)
   /engineering:tech-debt
   → "¿Qué debería refactorizar?"
```

---

## 💡 PRO TIPS

### Tip #1: Sé específico
✅ **Bueno:** "Revisar esta RLS policy que permite supervisores ver logs"
❌ **Malo:** "Revisar código"

### Tip #2: Proporciona contexto
✅ **Bueno:** "Esta query tarda 4.2s con 10k empleados, solo en prod"
❌ **Malo:** "¿Por qué es lento?"

### Tip #3: Usa ejemplos reales
✅ **Bueno:** Copiar el código exacto de tu repo
❌ **Malo:** Describir en palabras

### Tip #4: Pregunta específico
✅ **Bueno:** "¿Hay N+1 en este RPC? ¿Faltan índices?"
❌ **Malo:** "¿Está optimizado?"

### Tip #5: Dime el resultado esperado
✅ **Bueno:** "Debería retornar 3 columnas, tarda 200ms"
❌ **Malo:** "No sé qué está mal"

---

## 📞 CÓMO PEDIR AYUDA CORRECTAMENTE

### Formato estándar:

```
@Claude /[skill-name]

**Contexto:**
[Información de fondo]

**Problema/Necesidad:**
[Qué necesitas exactamente]

**Código/Datos:**
[Lo específico que necesitas revisar]

**Consideraciones:**
- [Constraint 1]
- [Constraint 2]

**Stack:**
Next.js 16 + React 19 + TypeScript + Supabase
```

### Ejemplo real:

```
@Claude /engineering:code-review

**Contexto:**
Estoy refactorizando el hook useAttendanceRealtime
para mejorar performance

**Problema/Necesidad:**
Revisar si hay memory leaks con las subscripciones

**Código:**
[pegar código del hook]

**Consideraciones:**
- Usamos useMemo para estabilizar
- Hay múltiples listeners

**Stack:**
Next.js 16 + Supabase Realtime
```

---

## 📊 MÉTRICAS: TIEMPO AHORRADO

**Antes** (sin skills):
- Code review manual: 30 min
- Debug sin estructura: 1+ hora
- System design: 3+ horas
- Documentación: 2+ horas

**Después** (con skills):
- Code review: 5-10 min (aprox)
- Debug estructurado: 15-20 min
- System design: 30-45 min
- Documentación: 10-15 min

**Ahorros semanales:** ~6-8 horas = +1 día completo de trabajo

---

## ✅ CHECKLIST: PRÓXIMOS PASOS

### Esta semana:
- [ ] Leer REPORTE_HABILIDADES_CLAUDE.md (5-10 min)
- [ ] Guardar PROMPTS_OPTIMIZADOS.md como referencia
- [ ] Usar /engineering:code-review antes de siguiente PR
- [ ] Usar /engineering:debug si encontrás un bug

### Este mes:
- [ ] Usar todas las 5 habilidades principales
- [ ] Revisar NUEVAS_SKILLS_PROPUESTAS.md
- [ ] Decidir si crear nuevas skills

### Próximas semanas:
- [ ] Si necesitas más automatización → crear `supabase-optimizer`
- [ ] Si refactorizas mucho → crear `nextjs-refactor-studio`
- [ ] Si mejoras testing → crear `supabase-rls-tester`

---

## 🚀 CONCLUSIÓN

**Tienes acceso a 14 habilidades profesionales.**

**Las 5 más importantes para ti:**
1. code-review (seguridad + performance)
2. debug (diagnosticar problemas)
3. system-design (planificar features)
4. documentation (mantener conocimiento)
5. deploy-checklist (ir a prod con confianza)

**Tiempo ahorrado:** 6-8 horas/semana

**Próximo paso:** Abre **PROMPTS_OPTIMIZADOS.md** y usa uno de los templates ahora mismo.

---

## 📎 ARCHIVOS GENERADOS

```
/marcacion-grupo-ct/
├── REPORTE_HABILIDADES_CLAUDE.md      ← Inventario + análisis
├── PROMPTS_OPTIMIZADOS.md             ← Templates listos para usar
├── NUEVAS_SKILLS_PROPUESTAS.md        ← 3 skills a crear (opcional)
└── README_HABILIDADES.md              ← Este archivo
```

---

**¿Preguntas? ¿Necesitas clarificación sobre alguna habilidad?**

Usa cualquiera de los skills ahora mismo. Todos estamos listos. 🚀
