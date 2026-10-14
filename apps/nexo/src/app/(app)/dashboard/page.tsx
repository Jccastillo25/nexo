import { redirect } from "next/navigation";

// Compatibilidad del ticket #13. El acceso se autoriza en la zona Agencia;
// requiere AGENCIA_APP_URL configurada y su destino desplegado antes del merge.
export default function DashboardAgenciaRedirect() {
  redirect("/agencia/dashboard");
}
