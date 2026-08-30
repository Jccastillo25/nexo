import { getPlatformSettings } from "@/lib/platform-settings";
import { PlatformSettingsForm } from "./PlatformSettingsForm";

export default async function SupadminSettingsPage() {
  const settings = await getPlatformSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Configuración de la plataforma</h1>
        <p className="text-slate-400">
          Nombre, logo y copyright que se muestran en toda la plataforma Ruta360.
        </p>
      </div>
      <PlatformSettingsForm settings={settings} />
    </div>
  );
}
