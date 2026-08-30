import Link from "next/link";
import { EMPRESA } from "@/data/empresa";

export default function Proximamente({ titulo }: { titulo: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6 sm:py-28">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-naranja">
        Próximamente
      </p>
      <h1 className="font-display text-3xl text-acero">{titulo}</h1>
      <p className="max-w-md font-mono text-sm text-acero-medio">
        Estamos preparando esta sección. Mientras tanto, escríbenos por
        WhatsApp y te atendemos directamente.
      </p>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <a
          href={EMPRESA.whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm bg-naranja px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-naranja/90"
        >
          Escríbenos por WhatsApp
        </a>
        <Link
          href="/"
          className="rounded-sm border border-acero-medio/40 px-6 py-3 text-sm font-semibold text-acero transition-colors hover:border-naranja hover:text-naranja"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
