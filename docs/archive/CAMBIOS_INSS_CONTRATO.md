# 📝 CAMBIOS - INSS Y FECHA DE INGRESO VINCULADOS AL CONTRATO

## Objetivo
Implementar la arquitectura correcta donde **INSS (Número de Afiliación INSS)** y **Fecha de Ingreso** son campos **específicos del contrato**, no del perfil del empleado. Esto permite que un empleado con múltiples contratos tenga diferentes valores INSS/Fecha según cada contrato.

---

## Cambios Implementados

### 1. ✅ Migración de Base de Datos

**Archivo**: `db/migrations/20260325_contracts_inss_hire_date.sql`

**Cambios**:
```sql
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS social_security_number TEXT,
ADD COLUMN IF NOT EXISTS hire_date DATE;

CREATE INDEX IF NOT EXISTS contracts_hire_date_idx ON public.contracts(hire_date);
CREATE INDEX IF NOT EXISTS contracts_social_security_idx ON public.contracts(social_security_number);
```

**Resultado**: Los campos INSS y Fecha de Ingreso ahora pertenecen a la tabla `contracts`, no a `employees`.

---

### 2. ✅ HiringWizard - Nuevo Step 3

**Archivo**: `app/(admin)/contracts/new/hiring-wizard.tsx`

**Cambios**:
- Expandido wizard de 5 a **6 pasos**
- **Nuevo Step 3**: "Información Legal y de Empleo"
  - Campo: `social_security_number` (Número INSS)
  - Campo: `hire_date` (Fecha de Ingreso por Contrato)
  - Mensaje informativo sobre la naturaleza contrato-específica de estos datos

**Resultado**:
```
Paso 1: Selección de Empleado
Paso 2: Puesto y Ubicación
→ Paso 3: Información Legal (INSS + Fecha Ingreso) [NUEVO]
Paso 4: Términos del Contrato
Paso 5: Asignación de Turno
Paso 6: Vista Previa y Finalización
```

---

### 3. ✅ ContractForm - Edición de Contratos

**Archivo**: `app/(admin)/contracts/[id]/edit/contract-form.tsx`

**Cambios**:
- Agregada nueva sección **"Información Legal"**
- Campos editables:
  - `social_security_number` (Número INSS)
  - `hire_date` (Fecha de Ingreso)
- Estos campos ahora aparecen junto con información general del contrato

**Resultado**: Los gerentes pueden editar/actualizar INSS y Fecha de Ingreso al modificar un contrato.

---

### 4. ✅ EmployeeEditWizard - Visualización Read-Only

**Archivo**: `app/(admin)/employees/[id]/edit/employee-edit-wizard.tsx`

**Cambios**:
- **Step 2 (Datos Legales)** ahora incluye una sección "Información del Contrato Activo"
- Campos **read-only** (solo lectura):
  - Número INSS (traído del contrato activo)
  - Fecha de Ingreso (traído del contrato activo)
- Muestra "Sin contrato activo" si no hay contrato vinculado
- El usuario **no puede editar** estos campos desde el perfil del empleado

**Resultado**:
```
[EMPLEADO]
├─ Datos Legales (Step 2)
│  ├─ Cédula de Identidad (editable)
│  ├─ N° RUC (editable)
│  ├─ Fecha de Nacimiento (editable)
│  ├─ Género (editable)
│  └─ Información del Contrato Activo (NUEVA - solo lectura)
│     ├─ INSS: [valor del contrato]
│     └─ Fecha de Ingreso: [valor del contrato]
```

---

### 5. ✅ Page Edit Employee - Query Actualizada

**Archivo**: `app/(admin)/employees/[id]/edit/page.tsx`

**Cambios**:
- Query de contratos ahora trae: `id, social_security_number, hire_date`
- Pasa `activeContract` como prop al wizard

**Resultado**: El wizard tiene acceso a los datos del contrato activo para mostrarlos.

---

### 6. ✅ Server Actions - Persistencia de Datos

**Archivo**: `app/actions/contracts.ts`

**Cambios en `createContract()`**:
- Captura `social_security_number` del FormData
- Captura `hire_date` del FormData
- Inserta estos valores al crear el contrato

**Cambios en `updateContract()`**:
- Captura `social_security_number` del FormData
- Captura `hire_date` del FormData
- Actualiza estos valores en la tabla contracts

**Resultado**: Los datos se guardan correctamente en la base de datos.

---

## Flujo de Datos (Ejemplo)

### Escenario: Crear nuevo contrato para empleado "Juan"

```
STEP 1: Selecciona "Juan"
↓
STEP 2: Selecciona Puesto "Gerente" en Sucursal "Managua"
↓
STEP 3: Ingresa INSS "123456789-0" y Fecha Ingreso "2026-03-25"
↓
STEP 4: Define Contrato "Indefinido" con Salario "5,000.00"
↓
STEP 5: Asigna Turno "Turno Día"
↓
STEP 6: Confirma y Finaliza
↓
CONTRATO CREADO:
├─ employee_id: [Juan's ID]
├─ social_security_number: "123456789-0"
├─ hire_date: "2026-03-25"
└─ ... otros datos
```

### Ver información en perfil de Juan

```
Editar Empleado → Juan → Datos Legales
├─ Cédula: 001-123456-1234A (editable)
├─ RUC: J1234567890123 (editable)
├─ Información del Contrato Activo (solo lectura):
│  ├─ INSS: 123456789-0 [desde contracts.social_security_number]
│  └─ Fecha Ingreso: 25/03/2026 [desde contracts.hire_date]
```

---

## Beneficios Arquitectónicos

| Antes | Después |
|-------|---------|
| INSS en `employees.social_security_id` | INSS en `contracts.social_security_number` |
| Hire_date en `employees.hire_date` | Hire_date en `contracts.hire_date` |
| Cuando un empleado tenía múltiples contratos, los datos se confundían | Cada contrato tiene sus propios INSS y fecha de ingreso |
| No había diferencia entre datos personales y datos contractuales | Ahora está claro: perfil ≠ contrato |

---

## Archivos Modificados

```
✏️ db/migrations/20260325_contracts_inss_hire_date.sql (NUEVO)
   - Creación de campos en tabla contracts

✏️ app/(admin)/contracts/new/hiring-wizard.tsx
   - Agregado Step 3 para INSS y Fecha de Ingreso
   - Progress bar actualizada a 6 pasos

✏️ app/(admin)/contracts/[id]/edit/contract-form.tsx
   - Agregada sección "Información Legal" para editar INSS y hire_date

✏️ app/(admin)/employees/[id]/edit/employee-edit-wizard.tsx
   - Step 2 ahora muestra INSS y Fecha Ingreso como read-only desde contrato
   - Agregadas props para recibir activeContract

✏️ app/(admin)/employees/[id]/edit/page.tsx
   - Query actualizada para traer social_security_number y hire_date del contrato
   - Pasa activeContract al wizard

✏️ app/actions/contracts.ts
   - createContract() captura y guarda social_security_number y hire_date
   - updateContract() captura y guarda social_security_number y hire_date
```

---

## Testing Recomendado

### 1. Crear Nuevo Contrato
- [ ] Navegar a "Nueva Contratación"
- [ ] Completar pasos 1-2 normalmente
- [ ] **Paso 3**: Verificar que aparezcan campos INSS y Fecha de Ingreso
- [ ] Ingresar INSS: "123456789-0" y Fecha: "2026-03-25"
- [ ] Completar pasos 4-6 e finalizar
- [ ] Verificar en BD: `contracts.social_security_number` y `contracts.hire_date` fueron creados

### 2. Ver Información en Perfil del Empleado
- [ ] Editar empleado con contrato activo
- [ ] Ir a **Paso 2: Datos Legales**
- [ ] Verificar sección "Información del Contrato Activo"
- [ ] **INSS y Fecha de Ingreso deben ser read-only** (no editables)
- [ ] Los valores deben coincidir con lo creado en el contrato

### 3. Editar Contrato Existente
- [ ] Ir a Contratos → Editar un contrato
- [ ] Buscar sección "Información Legal"
- [ ] Cambiar INSS a "987654321-9"
- [ ] Cambiar Fecha de Ingreso a "2025-01-01"
- [ ] Guardar cambios
- [ ] Volver al perfil del empleado
- [ ] Verificar que los valores en Step 2 se hayan actualizado

### 4. Múltiples Contratos
- [ ] Crear 2 contratos para el mismo empleado (uno histórico, uno activo)
- [ ] El empleado debe mostrar datos del **contrato activo** (no del histórico)
- [ ] Editar contrato histórico: verificar que no afecte lo que ve el empleado

### 5. Sin Contrato Activo
- [ ] Editar empleado SIN contrato activo
- [ ] Paso 2: Debe mostrar mensaje "Sin contrato activo"
- [ ] No debe haber campos INSS/Fecha de Ingreso visibles

---

## Notas Importantes

⚠️ **Migración**: Ejecutar migración antes de desplegar cambios en producción
```sql
psql -h host -U user -d database -f db/migrations/20260325_contracts_inss_hire_date.sql
```

✅ **RLS (Row Level Security)**: Verifica que las políticas de seguridad permitan SELECT/UPDATE en los nuevos campos.

✅ **Data Migration**: Si hay datos históricos de INSS en `employees.social_security_id`, considerar hacer un script de migración para copiarlos a `contracts.social_security_number` según el contrato activo de cada empleado.

---

## Próximos Pasos Opcionales

- [ ] Crear script para migrar datos históricos de INSS/hire_date de employees a contracts
- [ ] Agregar validación de formato INSS (si aplica según legislación nicaragüense)
- [ ] Crear reporte: "Empleados sin INSS en contrato"
- [ ] Agregar campo de "Confirmación INSS" en contratos impresos
- [ ] Auditoría: registrar cambios de INSS en cada contrato
