import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DriverHeader } from "@/components/DriverHeader";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("drivers")
    .select("full_name, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center text-slate-100">
        <h1 className="text-xl font-bold">Cuenta sin configurar</h1>
        <p className="text-slate-300">
          Tu usuario aún no está habilitado en ninguna empresa. Contacta a tu administrador.
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-900">
      <DriverHeader fullName={profile.full_name} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
