// Barra superior de RRHH. Es literalmente <ShellBar> de @nexo/ui — no un
// header propio (regla obligatoria, ver docs/DESIGN_SYSTEM.md). Mismo
// patron que apps/crm/src/components/Header.tsx.
import { ShellBar } from "@nexo/ui";
import { signOut } from "@/app/(app)/actions";

export default function Header({
  panelUrl,
  userEmail,
}: {
  panelUrl: string;
  userEmail?: string | null;
}) {
  return (
    <ShellBar
      title="RRHH"
      titleHref="/dashboard"
      backHref={panelUrl}
      userEmail={userEmail}
      onSignOut={signOut}
    />
  );
}
