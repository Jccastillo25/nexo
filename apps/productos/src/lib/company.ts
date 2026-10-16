/**
 * Igual que en apps/atencion/src/lib/company.ts: single-tenant por ahora,
 * fijado por env var.
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
