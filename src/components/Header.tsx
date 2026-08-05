import Link from "next/link";
import { signOut } from "@/app/login/actions";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-acero-medio/20 bg-concreto/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/clientes" className="flex flex-col leading-none">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-acero-medio">
            Materiales J Castillo
          </span>
          <span className="font-display text-base text-acero">
            Panel de clientes
          </span>
        </Link>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded-sm border border-acero-medio/40 px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-acero-medio transition-colors hover:border-naranja hover:text-naranja"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
