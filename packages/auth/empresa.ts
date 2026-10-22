/**
 * Empresa activa. Single-tenant por ahora: fijada por NEXO_COMPANY_ID (id de
 * 'materiales-jcastillo' en core.companies). Cuando haya más de una empresa
 * real, se resolverá desde la membresía del usuario (core.company_memberships).
 * La variable va en el proyecto de Vercel de CADA zona: no se comparte.
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
