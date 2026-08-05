import Image from "next/image";
import Link from "next/link";
import { EMPRESA } from "@/data/empresa";

export default function Home() {
  const mapQuery = encodeURIComponent(`${EMPRESA.nombre}, ${EMPRESA.direccion}`);

  return (
    <div className="flex flex-col">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6 sm:py-24">
        <Image
          src="/logo.png"
          alt={EMPRESA.nombre}
          width={480}
          height={284}
          priority
          className="h-20 w-auto sm:h-28"
        />

        <h1 className="max-w-2xl font-display text-3xl leading-tight text-acero sm:text-4xl">
          {EMPRESA.eslogan}
        </h1>

        <p className="max-w-xl font-mono text-sm text-acero-medio">
          Escríbenos por WhatsApp para consultar precios y disponibilidad, o
          visítanos en nuestra sucursal de Carretera Norte.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={EMPRESA.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm bg-naranja px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-naranja/90"
          >
            Escríbenos por WhatsApp
          </a>
          <a
            href={EMPRESA.telefonoPbxHref}
            className="rounded-sm border border-acero-medio/40 px-6 py-3 text-sm font-semibold text-acero transition-colors hover:border-naranja hover:text-naranja"
          >
            Llamar al PBX
          </a>
        </div>
      </section>

      <section className="border-t border-acero-medio/15 bg-white/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6">
          <div className="rounded-md border border-acero-medio/15 bg-concreto/60 p-5">
            <p className="font-mono text-xs uppercase tracking-wide text-acero-medio">
              Dirección
            </p>
            <p className="mt-2 text-sm text-acero">{EMPRESA.direccion}</p>
          </div>
          <div className="rounded-md border border-acero-medio/15 bg-concreto/60 p-5">
            <p className="font-mono text-xs uppercase tracking-wide text-acero-medio">
              PBX
            </p>
            <a
              href={EMPRESA.telefonoPbxHref}
              className="mt-2 block text-sm text-acero hover:text-naranja"
            >
              {EMPRESA.telefonoPbx}
            </a>
          </div>
          <div className="rounded-md border border-acero-medio/15 bg-concreto/60 p-5">
            <p className="font-mono text-xs uppercase tracking-wide text-acero-medio">
              WhatsApp
            </p>
            <a
              href={EMPRESA.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm text-acero hover:text-naranja"
            >
              {EMPRESA.whatsappNumero}
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-acero-medio/15">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="font-display text-xl text-acero">Visítanos</h2>
          <p className="mt-1 max-w-xl font-mono text-sm text-acero-medio">
            {EMPRESA.direccion}
          </p>
          <div className="mt-5 h-72 overflow-hidden rounded-md border border-acero-medio/20 sm:h-96">
            <iframe
              title="Ubicación en el mapa"
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-acero-medio/15 bg-white/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-12 text-center sm:px-6">
          <p className="font-mono text-xs uppercase tracking-wide text-acero-medio">
            Muy pronto
          </p>
          <p className="max-w-md text-sm text-acero">
            Estamos preparando las páginas de{" "}
            <Link href="/quienes-somos" className="text-naranja hover:underline">
              Quiénes somos
            </Link>{" "}
            y{" "}
            <Link href="/productos" className="text-naranja hover:underline">
              Productos
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
