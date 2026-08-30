// Barra superior del CRM. Es literalmente <ShellBar> de @nexo/ui — no un
// header propio (ver docs/planning/NORMA_DISENO_UNIVERSAL.md §2.1). El CRM
// ya no tiene paleta/tipografía de marca propia — todo el módulo, barra y
// contenido, usa el mismo sistema de diseño que el resto de la suite.
import { ShellBar } from "@nexo/ui";
import { signOut } from "@/app/login/actions";

export default function Header({
  panelUrl,
  userEmail,
}: {
  panelUrl: string;
  userEmail?: string | null;
}) {
  return (
    <ShellBar
      title="CRM"
      titleHref="/clientes"
      backHref={panelUrl}
      userEmail={userEmail}
      onSignOut={signOut}
    />
  );
}
