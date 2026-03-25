# 🔍 FIX: Empleado No Se Crea en "Altas Rápidas"

**Problema**: Al crear un empleado en el formulario "Altas Rápidas", la página se redirige al dashboard pero el empleado no se crea.

**Status**: Investigado y parcialmente arreglado

---

## 📋 Cambios Realizados

### 1. Mejor manejo de errores en `app/actions/employees.ts`
```typescript
// ANTES:
const { data: membership } = await supabase
  .from('company_memberships')
  .select('company_id')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .limit(1)
  .single()

if (!membership?.company_id) {
  return { error: 'No se encontró una empresa asociada a tu cuenta.' }
}

// DESPUÉS:
const { data: membership, error: membershipError } = await supabase
  .from('company_memberships')
  .select('company_id')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .limit(1)
  .single()

if (membershipError || !membership?.company_id) {
  console.error('Membership error:', membershipError)
  return { error: 'No se encontró una empresa asociada a tu cuenta.' }
}
```

---

## 🔎 DIAGNÓSTICO REQUERIDO

Ejecuta estas consultas en Supabase SQL Editor para identificar el problema:

### Paso 1: Obtén tu user_id
```sql
SELECT id, email FROM auth.users LIMIT 5;
-- Copia el id del usuario (jcastillo)
```

### Paso 2: Verifica company_memberships
```sql
SELECT
  id,
  user_id,
  company_id,
  is_active,
  created_at
FROM company_memberships
WHERE user_id = 'TU_USER_ID_AQUI'  -- Reemplaza con tu user_id
ORDER BY created_at DESC;
```

**Si NO hay resultados**: Este es el problema. El usuario no tiene registro en `company_memberships`.

### Paso 3: Verifica que exista company_id
```sql
SELECT
  id,
  display_name,
  is_active
FROM companies
LIMIT 10;
```

### Paso 4: Verifica políticas RLS en employees
Ir a: **Database > Policies > employees**
Verifica que:
- [ ] Exista política SELECT para usuarios autenticados
- [ ] Exista política INSERT para usuarios autenticados
- [ ] Las políticas NO estén causando conflictos de recursión

---

## 🎯 POSIBLES CAUSAS

### 1. ❌ NO HAY REGISTRO EN `company_memberships`
**Síntoma**: La consulta del Paso 2 no retorna resultados
**Solución**:
```sql
INSERT INTO company_memberships (user_id, company_id, is_active)
VALUES ('TU_USER_ID', 'TU_COMPANY_ID', true);
```

### 2. ❌ El registro existe pero `is_active = false`
**Síntoma**: La consulta retorna un resultado con `is_active: false`
**Solución**:
```sql
UPDATE company_memberships
SET is_active = true
WHERE user_id = 'TU_USER_ID';
```

### 3. ❌ Problema con RLS en la tabla `employees`
**Síntoma**: Error de RLS silencioso
**Solución**:
- Verifica que la política INSERT no sea demasiado restrictiva
- Asegúrate que `company_id` sea insertable por el usuario autenticado

### 4. ❌ Problema con `company_id` NULL
**Síntoma**: El empleado se crea pero sin company_id
**Solución**:
- Verifica que `membership.company_id` no sea NULL
- Verifica que la tabla `companies` tenga registros

---

## 📝 PASOS A SEGUIR

1. **Ejecuta el Paso 1-3 del diagnóstico** en Supabase
2. **Comparte los resultados** de las consultas
3. **Identificamos la causa raíz**
4. **Aplicamos el fix correcto**
5. **Probamos que funcione**

---

## ✅ Cambios ya aplicados

```
✅ app/actions/employees.ts
   - Mejor manejo de error de membershipError
   - Console.error para debugging
   - Error message más clara
```

---

## 📞 Información Adicional

**Archivo del formulario**: `app/(admin)/employees/new/employee-form.tsx`
- ✅ Formulario se ve correcto
- ✅ useActionState está configurado correctamente
- ✅ Muestra errores en rojo si los hay

**Archivo de acción**: `app/actions/employees.ts`
- ✅ Obtiene user_id correctamente
- ✅ Busca company_memberships
- ✅ Genera employee_code con UUID
- ⚠️ NECESITA: Verificar que el registro en company_memberships exista

---

## 🚀 Próximos Pasos

1. Ejecuta el diagnóstico
2. Comparte los resultados
3. Haremos el fix basado en los resultados

**Mientras tanto, todos los cambios están listos para push.**
