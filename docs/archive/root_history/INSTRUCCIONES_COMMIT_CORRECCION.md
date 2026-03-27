# 📝 Instrucciones para Commit de Corrección

## Ejecuta esto en PowerShell

```powershell
# 1. Posicionarse en la raíz del repositorio
Set-Location "C:\Users\Gerencia\Documents\GitHub\marcacion-grupo-ct"

# 2. Verificar estado
git status

# 3. Hacer el commit
git commit -am "fix: Usar shift_schedules para horarios por día dentro de un turno

- Nueva tabla shift_schedules para almacenar horarios por día de la semana
- Un solo turno 'Turno Administrativo' con múltiples horarios por día
- getTodayShift() ahora consulta shift_schedules primero
- Fallback a shifts si no hay registro específico del día
- Sábado: 08:00-15:00, L-V: 07:30-17:00
- Elimina necesidad de turnos duplicados

BREAKING CHANGE: Se agrega tabla shift_schedules, se elimina 'Turno Administrativo - Sábado'

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# 4. Verificar que se hizo el commit
git log --oneline -3

# 5. Push a GitHub
git push origin main

# 6. Build
Set-Location "C:\Users\Gerencia\Documents\GitHub\marcacion-grupo-ct\web"
npm run build
```

---

## ¿Qué cambió?

- ✅ Se ejecutó SQL en Supabase (tabla shift_schedules + datos)
- ✅ Código en `kiosk.ts` ahora consulta `shift_schedules`
- ✅ Un solo turno con múltiples horarios por día
- ✅ Lógica correcta de detección de horario por día

---

## Resultado esperado después del push

```
To https://github.com/jcaatillo/marcacion-grupo-ct.git
   29d1b51..NUEVOHASH  main -> main
```
