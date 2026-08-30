import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { countAdmins, countDrivers } from "@/lib/company-quota";
import { EditCompanyForm } from "./EditCompanyForm";

export default async function SupadminEditCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("id, name, ruc, address, phone, email, logo_url, max_users, max_drivers, is_active")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) redirect("/supadmin");

  const [adminCount, driverCount] = await Promise.all([
    countAdmins(admin, companyId),
    countDrivers(admin, companyId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{company.name}</h1>
        <p className="text-slate-400">
          {adminCount} administrador(es) · {driverCount} conductor(es)
        </p>
      </div>
      <EditCompanyForm company={company} />
    </div>
  );
}
