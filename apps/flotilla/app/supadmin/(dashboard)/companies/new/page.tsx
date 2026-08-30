import { NewCompanyForm } from "./NewCompanyForm";

export default function SupadminNewCompanyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Nueva empresa</h1>
        <p className="text-slate-400">Crea la empresa y su primer usuario administrador.</p>
      </div>
      <NewCompanyForm />
    </div>
  );
}
