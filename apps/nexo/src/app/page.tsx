import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { signOut } from "./login/actions";

export const metadata: Metadata = {
  title: "Nexo",
};

const COLOR_CLASSES: Record<string, string> = {
  gris: "bg-neutral-100 text-neutral-700",
  ambar: "bg-amber-100 text-amber-800",
  azul: "bg-blue-100 text-blue-800",
  rosa: "bg-pink-100 text-pink-800",
};

export default async function PanelPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: apps, error } = await supabase.rpc("get_visible_apps", {
    p_company_id: companyId,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
            Grupo CT
          </p>
          <h1 className="text-2xl font-semibold">Nexo</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          {user?.email && <span>{user.email}</span>}
          <form action={signOut}>
            <button type="submit" className="underline underline-offset-2 hover:text-neutral-800">
              Salir
            </button>
          </form>
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo cargar la lista de módulos: {error.message}
        </p>
      )}

      {!error && (apps?.length ?? 0) === 0 && (
        <p className="rounded-md border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500">
          No tienes ningún módulo habilitado todavía. Esto es DENY BY
          DEFAULT funcionando como se espera — pedile a un owner/admin que
          te agregue una membresía en <code>core.company_memberships</code>{" "}
          o un permiso explícito en <code>core.user_permissions</code>.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {apps?.map((app) => (
          <Link
            key={app.slug}
            href={app.route}
            className="flex flex-col items-center gap-3 rounded-lg border border-neutral-200 bg-white p-5 text-center transition-shadow hover:shadow-md"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-lg text-lg font-semibold ${
                COLOR_CLASSES[app.color ?? ""] ?? "bg-neutral-100 text-neutral-700"
              }`}
            >
              {app.name.charAt(0)}
            </span>
            <span className="text-sm font-medium">{app.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
