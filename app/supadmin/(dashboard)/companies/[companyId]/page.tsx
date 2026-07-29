import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("id, name, ruc, address, phone, email, logo_url, max_users, is_active")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) redirect("/supadmin");

  const { count: userCount } = await admin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{company.name}</h1>
        <p className="text-slate-400">{userCount ?? 0} usuario(s) registrados en esta empresa.</p>
      </div>
      <EditCompanyForm company={company} />
    </div>
  );
}
