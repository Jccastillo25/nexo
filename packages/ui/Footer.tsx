// Copyright de toda la plataforma — pedido explicito del usuario. El texto
// sale de core.platform_settings.copyright_text (editable desde
// apps/nexo/src/app/ajustes), cada app lo resuelve server-side y lo pasa
// como prop; este componente solo lo pinta, igual en todos los modulos.
import { shellFont } from "./shell-font";

export interface FooterProps {
  text: string;
}

export function Footer({ text }: FooterProps) {
  return (
    <footer
      className={`${shellFont.className} border-t border-neutral-200 bg-white px-6 py-3 text-center text-xs text-neutral-400`}
    >
      {text}
    </footer>
  );
}
