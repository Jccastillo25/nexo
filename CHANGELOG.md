# Changelog

Todos los cambios significativos en este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/) y el proyecto sigue [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-03-24

### Fixed

#### 🐛 Employee Code Auto-Generation
- **Issue**: Creating employees in "Altas Rápidas" failed with `null value in column "employee_code" violates not-null constraint`
- **Solution**: Implemented auto-generation of unique employee codes using UUID format
- **Format**: `EMP-` + 8 random uppercase characters (e.g., `EMP-A7F2B9C1`)
- **Modified**: `app/actions/employees.ts`
- **Commit**: `b61bfdc`
- **Related Documentation**:
  - `DEBUG_SESSION_REPORT.md` — Detailed technical analysis
  - `EMPLOYEE_CODE_FIX.md` — Implementation details

#### 🔐 RLS Policy Consolidation
- **Issue**: Two conflicting INSERT policies on `employees` table caused "infinite recursion" error
  - Old policy referenced `employees` table (circular dependency)
  - New policy properly used `company_memberships` lookup table
- **Solution**: Verified old policy was removed, consolidating to single correct policy
- **Impact**: Eliminated circular RLS logic, improved authorization model
- **Migration**: Already applied in `db/migrations/20260324_fix_rls_recursion.sql`

### Changed

- Updated `README.md` with recent changes and fix documentation
- Added references to debug session reports in documentation

### Security

- Improved Row-Level Security policies to eliminate circular dependencies
- RLS policies now properly use lookup table pattern (`company_memberships`) for authorization checks

---

## Implementation Timeline

```
2026-03-24 10:30 — Identified RLS recursion error
2026-03-24 11:45 — Diagnosed old vs. new RLS policies conflict
2026-03-24 12:15 — Applied employee_code auto-generation fix
2026-03-24 13:00 — Verified fix in UI (employee creation working)
2026-03-24 13:30 — Created comprehensive documentation
2026-03-24 14:00 — Ready for GitHub push
```

---

## How to Review These Changes

### For Code Review
1. Review commit `b61bfdc` — Focus on `app/actions/employees.ts`
2. Check that `employee_code` is generated before insertion
3. Verify format matches business requirements (`EMP-XXXXXXXX`)

### For Database Review
1. Verify no old RLS policies remain on `employees` table:
   ```sql
   SELECT policyname FROM pg_policies
   WHERE tablename = 'employees' AND cmd = 'INSERT';
   ```
2. Confirm only one INSERT policy exists: "Managers can insert employees in their company"

### For Testing
1. Navigate to **Altas Rápidas** → **Empleados**
2. Create a test employee
3. Verify:
   - ✅ Employee created successfully
   - ✅ `employee_code` field populated (format: `EMP-XXXXXXXX`)
   - ✅ No RLS or constraint errors

---

## Known Issues & Limitations

### Current
- None known at this time

### Future Considerations
- Consider making `employee_code` format configurable
- Add database DEFAULT value for `employee_code` as alternative approach
- Implement RLS policy testing in CI/CD pipeline

---

## Related Documentation

- `DEBUG_SESSION_REPORT.md` — Complete debug session analysis
- `EMPLOYEE_CODE_FIX.md` — Technical details of the fix
- `ROOT_CAUSE_IDENTIFIED.md` — Root cause analysis
- `BUG_RESOLUTION_SUMMARY.md` — Summary of all fixes
- `DIAGNOSTIC_QUERIES.sql` — Useful queries for debugging

---

## Contributors

- **Julio Castillo** — Bug fix implementation and documentation
- **Claude (AI Assistant)** — Debugging, analysis, and documentation generation

---

## Notes for Future Development

1. **RLS Policy Best Practices**
   - Never use circular subqueries in RLS policies
   - Use lookup tables (`company_memberships`) for authorization
   - Keep SELECT policies simple without complex logic

2. **Employee Code Format**
   - Current: UUID-based (e.g., `EMP-A7F2B9C1`)
   - Future: Consider sequential format if needed

3. **Documentation**
   - Keep `DEBUG_SESSION_REPORT.md` for reference
   - Update this `CHANGELOG.md` with each significant change
   - Add RLS policy documentation to architecture docs

