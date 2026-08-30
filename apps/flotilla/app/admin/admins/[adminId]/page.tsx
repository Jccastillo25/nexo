import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditAdminForm } from "./EditAdminForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function EditAdminPage({
  params,
}: {
  params: Promise<{ adminId: string }>;
}) {
  const { adminId } = await params;
  const supabase = await createClient();

  const { data: admin } = await supabase
    .from("admins")
    .select("id, full_name, email, is_active")
    .eq("id", adminId)
    .maybeSingle();

  if (!admin) redirect("/admin/admins");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/admins" className="text-sm text-slate-400 hover:text-slate-200">
          ← Volver a administradores
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-100">{admin.full_name}</h1>
        <p className="text-slate-400">{admin.email}</p>
      </div>

      <EditAdminForm admin={admin} />

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-100">Restablecer contraseña</h2>
        <ResetPasswordForm adminId={admin.id} />
      </section>
    </div>
  );
}
