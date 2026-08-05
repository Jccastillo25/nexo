import { EMPRESA } from "@/data/empresa";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-acero-medio/15 bg-acero text-concreto">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-display text-lg">{EMPRESA.nombre}</p>
          <p className="mt-1 text-sm text-concreto/70">{EMPRESA.eslogan}</p>
        </div>

        <div className="text-sm text-concreto/80">
          <p className="font-mono text-xs uppercase tracking-wide text-concreto/50">
            Dirección
          </p>
          <p className="mt-1">{EMPRESA.direccion}</p>
        </div>

        <div className="text-sm text-concreto/80">
          <p className="font-mono text-xs uppercase tracking-wide text-concreto/50">
            Contacto
          </p>
          <p className="mt-1">
            <a href={EMPRESA.telefonoPbxHref} className="hover:text-naranja">
              PBX: {EMPRESA.telefonoPbx}
            </a>
          </p>
          <p className="mt-0.5">
            <a
              href={EMPRESA.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-naranja"
            >
              WhatsApp: {EMPRESA.whatsappNumero}
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-concreto/10 px-4 py-4 text-center font-mono text-xs text-concreto/50 sm:px-6">
        © {year} {EMPRESA.nombre}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
