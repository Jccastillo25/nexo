// Barra superior del CRM. Es literalmente <ShellBar> de @nexo/ui — no un
// header propio (ver docs/planning/NORMA_DISENO_UNIVERSAL.md §2.1): la
// identidad del CRM (concreto/acero/naranja, font-display/mono) vive en el
// contenido de cada página ("Clientes", "Editar cliente"...), no en esta
// barra, que se ve y se comporta igual en toda la suite.
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
