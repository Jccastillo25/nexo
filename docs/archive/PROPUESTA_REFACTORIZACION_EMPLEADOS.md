# 📋 PROPUESTA DE REFACTORIZACIÓN: GESTIÓN DE EMPLEADOS

## PROBLEMA IDENTIFICADO

El usuario reporta que:
1. La información de empleados está **poco ordenada**
2. **Falta información útil** en el dashboard
3. **Los tabs son confusos** - no hacen referencia clara de qué contienen
4. **No hay validación** para eliminar empleados con contratos activos

---

## SOLUCIÓN PROPUESTA

### 1. REDISEÑO DEL DASHBOARD DE EMPLEADOS (Listado)

#### Información actual (insuficiente):
- Nombre
- Sucursal
- PIN
- Estado
- Acciones (Ver/Editar)

#### Información mejorada (propuesta):
| Campo | Propósito | Valor |
|-------|-----------|-------|
| **Nombre + Avatar** | Identificación visual rápida | Foto o iniciales |
| **Email** | Contacto | esaballo@example.com |
| **Sucursal** | Ubicación | Jcastillo |
| **Puesto** | Rol actual | Gerente/Admin |
| **Estado Contractual** | Crítico - saber si tiene contrato | 🟢 Activo / 🔴 Sin contrato / 🟡 Vencido |
| **Fecha Inicio** | Antigüedad | 15 ene 2024 |
| **Próximo Vencimiento** | Alerta | 15 dic 2024 (en rojo si <30 días) |
| **PIN** | Acceso Kiosko | ✅ Sí / ❌ Pendiente |
| **Acciones** | Operaciones | Ver · Editar · **Eliminar** |

#### Tabla mejorada:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ NOMBRE                  │ PUESTO      │ ESTADO CONTRATO │ VENCIMIENTO │ ... │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📸 Bryan Torrez         │ Gerente     │ 🟢 Activo       │ 15 dic      │ ✎   │
│    btorrez@...          │             │                 │             │ ✕   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📸 Edith Saballos       │ Asistente   │ 🟡 Vencido      │ ⚠️ 05 ago   │ ✎   │
│    esaballo@...         │             │                 │ (21 días)   │ ✕   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2. REFACTORIZACIÓN DE TABS EN PERFIL DE EMPLEADO

#### Estructura actual (confusa):
```
[General] [Legal (ID)] [Seguridad y Kiosko] [Ubicación] [Foto]
```

**Problema**: Los tabs no tienen una narrativa clara, se sienten arbitrarios.

#### Estructura propuesta (lógica):

```
┌──────────────────────────────────────────────────────────────────┐
│ INFORMACIÓN PERSONAL │ DATOS LEGALES │ UBICACIÓN Y PUESTO │ ACCESO │ FOTO │
└──────────────────────────────────────────────────────────────────┘
```

**Explicación de cada tab:**

1. **INFORMACIÓN PERSONAL** (Datos básicos del empleado)
   - Nombre, Apellidos
   - Email, Teléfono
   - Fecha de Nacimiento
   - Género
   - Fecha de Hire (contratación)
   - Estado (Activo/Inactivo)

2. **DATOS LEGALES** (Documentación e identificación)
   - Cédula Nacional (ID)
   - RUC (Impuestos)
   - INSS (Seguridad Social)
   - Dirección legal
   - Información de afiliación

3. **UBICACIÓN Y PUESTO** (Operacional - Dónde trabaja y qué hace)
   - Sucursal
   - Puesto de trabajo
   - Departamento
   - Reporta a: [Jefe directo]
   - Número de empleado (auto-generado)

4. **ACCESO Y KIOSKO** (Seguridad - Control de entrada)
   - PIN para Kiosko
   - Código de empleado
   - Estado de acceso
   - Historial de cambios de PIN
   - Botón: Generar/Resetear PIN

5. **FOTO** (Visual)
   - Foto de perfil
   - Cambiar foto
   - Sincronizar con API externa

---

### 3. FUNCIONALIDAD DE ELIMINACIÓN

#### Dashboard (Listado):
- Agregar botón "**Eliminar**" rojo en cada fila
- Al hacer clic: Validar si el empleado tiene contrato activo

#### Validación:
```javascript
if (employee.hasActiveContract) {
  alert('⚠️ No se puede eliminar.\n\nEste empleado tiene un contrato ACTIVO.\n\nDebes:\n1. Anular o finalizar el contrato\n2. Luego podrás eliminar el empleado')
  return
}
```

#### En el perfil del empleado:
- Botón "Eliminar empleado" en la sección de acciones
- Mismo flujo de validación
- Mostrar estado contractual de forma prominente

---

### 4. CAMBIOS EN LA BASE DE DATOS (backend)

#### Queries mejoradas:

**Dashboard - Obtener lista enriquecida:**
```sql
SELECT
  e.id,
  e.first_name,
  e.last_name,
  e.email,
  e.photo_url,
  jp.name as job_position_name,
  br.name as branch_name,
  e.hire_date,
  CASE
    WHEN MAX(c.status) = 'active' THEN 'active'
    WHEN MAX(c.status) = 'expired' THEN 'expired'
    ELSE 'no_contract'
  END as contract_status,
  MAX(c.end_date) as contract_end_date,
  e.is_active,
  CASE WHEN e.employee_code IS NOT NULL THEN true ELSE false END as has_pin
FROM employees e
LEFT JOIN contracts c ON e.id = c.employee_id
LEFT JOIN job_positions jp ON e.job_position_id = jp.id
LEFT JOIN branches br ON e.branch_id = br.id
GROUP BY e.id, e.first_name, e.last_name, e.email, e.photo_url, jp.name, br.name, e.hire_date, e.is_active, e.employee_code
ORDER BY e.first_name
```

**Validación para eliminación:**
```javascript
const { data: activeContract } = await supabase
  .from('contracts')
  .select('id')
  .eq('employee_id', employeeId)
  .eq('status', 'active')
  .single() // Si retorna algo = tiene contrato activo

if (activeContract) {
  throw new Error('Empleado tiene contrato activo. Debe anularse primero.')
}
```

---

## IMPLEMENTACIÓN PROPUESTA

### Fase 1: Dashboard mejorado
- [ ] Actualizar query de empleados para incluir información contractual
- [ ] Modificar tabla para mostrar puesto, estado contractual, vencimiento
- [ ] Agregar botón Eliminar
- [ ] Implementar validación de eliminación

### Fase 2: Refactorización de tabs
- [ ] Renombrar y reorganizar tabs con nueva estructura
- [ ] Mover campos a los tabs correctos
- [ ] Mejorar descripción visual de cada tab
- [ ] Agregar validación de formulario por tab

### Fase 3: Acción de eliminación
- [ ] Crear Server Action para eliminar empleado
- [ ] Implementar validación de contratos
- [ ] Agregar confirmación visual
- [ ] Mensajes de error claros

### Fase 4: Polish
- [ ] Agregar indicadores visuales (badges para estado contractual)
- [ ] Colorear alertas de vencimiento próximo
- [ ] Testing de validaciones
- [ ] Documentación

---

## BENEFICIOS

✅ **Información Clara**: El usuario sabe de un vistazo quién tiene contrato
✅ **Navegación Intuitiva**: Los tabs tienen sentido lógico
✅ **Seguridad**: No se puede eliminar empleados con contratos activos
✅ **UX Mejorada**: Menos clicks para ver información crítica
✅ **Escalable**: Nueva estructura soporta más información futura

---

## PREGUNTAS PARA CONFIRMAR

1. ¿Te gustaría agregar más campos al dashboard? (ej: antigüedad, salario)
2. ¿El orden de los tabs propuesto tiene sentido para tu flujo?
3. ¿Quieres una vista de "Contatos a vencer pronto" como alerta?
4. ¿Necesitas exportar la lista de empleados a Excel/PDF?

