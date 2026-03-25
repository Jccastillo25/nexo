# Employee Code Fix - Auto-Generation Implementation

## Problem
When creating a new employee, the form was inserting `null` into the `employee_code` column, which violates the NOT NULL constraint.

```
Error: null value in column "employee_code" of relation "employees" violates not-null constraint
```

## Solution Implemented
Modified `app/actions/employees.ts` to **auto-generate a unique employee code** before inserting.

### What Changed

**Before:**
```typescript
const { error } = await supabase.from('employees').insert({
  employee_code: null, // ← NOT ALLOWED
  first_name,
  last_name,
  ...
})
```

**After:**
```typescript
// Generar un employee_code único usando UUID
// Formato: EMP-[UUID corta de 8 caracteres]
const crypto = await import('crypto')
const employee_code = `EMP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`

const { error } = await supabase.from('employees').insert({
  employee_code, // ← Now generated automatically
  first_name,
  last_name,
  ...
})
```

## Format
- **Pattern**: `EMP-` + 8 random uppercase characters
- **Examples**:
  - `EMP-A7F2B9C1`
  - `EMP-D3E4F5G6`
  - `EMP-K2L1M0N9`

## Advantages
✅ Unique (uses UUID underneath)
✅ Human-readable (starts with EMP-)
✅ Consistent format
✅ No database round-trips needed
✅ Works in the application layer

## Testing
1. Go to **Altas Rápidas** → **Empleados**
2. Fill in the form:
   - Nombres: `Juan Carlos`
   - Apellidos: `Pérez Gómez`
   - Correo: `correo@empresa.com`
3. Click **Crear colaborador**
4. The employee should be created successfully with an auto-generated code

## Notes
- The `employee_code` is generated at creation time and cannot be changed
- If you need different formatting (sequential, custom prefix, etc.), update the format on line 45
- The PIN (`employee_pin`) is still generated separately from the "Seguridad y Kiosko" tab

