/**
 * Igual que en apps/crm/src/lib/company.ts: single-tenant por ahora, fijado
 * por env var. Cuando haya mas de una empresa real usando el panel, esto se
 * reemplaza por resolver la empresa desde la sesion/membresia del usuario
 * (core.company_memberships) en vez de una constante.
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
