/**
 * El CRM es, por ahora, de un solo tenant: Materiales J Castillo. En vez de
 * resolverlo con una query extra en cada request, se fija por variable de
 * entorno (el id real de core.companies, sembrado en
 * supabase/migrations/20260830000004_seed_materiales_jcastillo.sql).
 *
 * Cuando el CRM deje de ser single-tenant, esto se reemplaza por resolver
 * la empresa desde la sesión/membresía del usuario (core.company_memberships).
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
