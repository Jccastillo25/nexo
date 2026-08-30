import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { SupadminSidebar } from "@/components/SupadminSidebar";

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

  const { productName, logoUrl } = await getPlatformSettings();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 md:flex-row">
      <SupadminSidebar productName={productName} logoUrl={logoUrl} />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
