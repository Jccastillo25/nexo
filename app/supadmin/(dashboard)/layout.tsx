import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupadminHeader } from "@/components/SupadminHeader";

export default async function SupadminDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/supadmin/login");

  const { data: platformAdmin } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!platformAdmin) redirect("/supadmin/login");

  return (
    <div className="min-h-dvh bg-slate-950">
      <SupadminHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
