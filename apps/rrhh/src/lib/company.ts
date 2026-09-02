/**
 * RRHH es, por ahora, de un solo tenant: Materiales J Castillo — mismo
 * patron single-tenant que apps/crm/src/lib/company.ts, mismo id real
 * (core.companies, sembrado en
 * supabase/migrations/20260830000004_seed_materiales_jcastillo.sql).
 *
 * Cuando RRHH deje de ser single-tenant, esto se reemplaza por resolver
 * la empresa desde la sesion/membresia del usuario
 * (core.company_memberships).
 */
export function getCompanyId(): string {
  const id = process.env.NEXO_COMPANY_ID;
  if (!id) {
    throw new Error(
      "Falta NEXO_COMPANY_ID en las variables de entorno (id de 'materiales-jcastillo' en core.companies)."
    );
  }
  return id;
}
