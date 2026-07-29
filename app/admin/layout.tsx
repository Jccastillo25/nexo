import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/AdminHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/driver");
  }

  return (
    <div className="min-h-dvh bg-slate-950">
      <AdminHeader fullName={profile.full_name} />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
