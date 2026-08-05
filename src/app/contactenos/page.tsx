import type { Metadata } from "next";
import { EMPRESA } from "@/data/empresa";

export const metadata: Metadata = {
  title: `Contáctenos · ${EMPRESA.nombre}`,
};

export default function ContactenosPage() {
  const mapQuery = encodeURIComponent(`${EMPRESA.nombre}, ${EMPRESA.direccion}`);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl text-acero">Contáctenos</h1>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-acero-medio">
              Dirección
            </p>
            <p className="mt-1 text-acero">{EMPRESA.direccion}</p>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-acero-medio">
              PBX
            </p>
            <a
              href={EMPRESA.telefonoPbxHref}
              className="mt-1 block text-acero hover:text-naranja"
            >
              {EMPRESA.telefonoPbx}
            </a>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-acero-medio">
              WhatsApp
            </p>
            <a
              href={EMPRESA.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-acero hover:text-naranja"
            >
              {EMPRESA.whatsappNumero}
            </a>
          </div>

          <a
            href={EMPRESA.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex w-fit items-center justify-center rounded-sm bg-naranja px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-naranja/90"
          >
            Escríbenos por WhatsApp
          </a>
        </div>

        <div className="h-72 overflow-hidden rounded-md border border-acero-medio/20 sm:h-full">
          <iframe
            title="Ubicación en el mapa"
            src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            className="h-full w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
