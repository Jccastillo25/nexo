import Image from "next/image";
import Link from "next/link";
import { EMPRESA } from "@/data/empresa";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/quienes-somos", label: "Quiénes somos" },
  { href: "/productos", label: "Productos" },
  { href: "/contactenos", label: "Contáctenos" },
] as const;

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-acero-medio/15 bg-concreto/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt={EMPRESA.nombre}
            width={160}
            height={64}
            priority
            className="h-9 w-auto sm:h-12"
          />
        </Link>

        <nav className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-sm px-2 py-2 text-xs font-medium text-acero-medio transition-colors hover:text-naranja sm:px-3 sm:text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
