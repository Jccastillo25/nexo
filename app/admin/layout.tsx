import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("admins")
    .select("full_name, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/driver");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("name, logo_url")
    .eq("id", profile.company_id)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 md:flex-row">
      <AdminSidebar
        fullName={profile.full_name}
        companyName={company?.name ?? ""}
        logoUrl={company?.logo_url ?? null}
      />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
