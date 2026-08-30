import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanyProfileForm } from "./CompanyProfileForm";

export default async function AdminCompanyPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("admins")
    .select("company_id")
    .eq("id", user!.id)
    .single();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, ruc, address, phone, email, logo_url")
    .eq("id", profile!.company_id)
    .maybeSingle();

  if (!company) redirect("/admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Perfil de empresa</h1>
        <p className="text-slate-400">Nombre, datos fiscales y logo de tu empresa.</p>
      </div>
      <CompanyProfileForm company={company} />
    </div>
  );
}
