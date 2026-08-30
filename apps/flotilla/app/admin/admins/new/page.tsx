import Link from "next/link";
import { NewAdminForm } from "./NewAdminForm";

export default function NewAdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/admins" className="text-sm text-slate-400 hover:text-slate-200">
          ← Volver a administradores
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-100">Crear administrador</h1>
      </div>
      <NewAdminForm />
    </div>
  );
}
