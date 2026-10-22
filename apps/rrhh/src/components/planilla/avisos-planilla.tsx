import { Alert } from "@nexo/ui";
import { separarAvisos } from "@/lib/planilla/estados";

/**
 * Avisos de una planilla, una liquidación o una simulación (texto de la RPC).
 * Sin "use client": sirve en Server Components y dentro de componentes
 * cliente.
 *
 * - Los de un valor que confirma el contador ("Valor pendiente de confirmar
 *   con el contador: …", o que mencionan esa confirmación) van juntos en un
 *   Alert info, sin el prefijo y con el nombre de negocio del parámetro.
 * - El resto, en un Alert warning.
 * - Sin avisos no muestra nada.
 */
export function AvisosPlanilla({
  avisos,
  titulo = "Revisa estos avisos",
  className,
}: {
  avisos: readonly string[] | null | undefined;
  /** Título del bloque de avisos que no son del contador. */
  titulo?: string;
  className?: string;
}) {
  const { contador, otros } = separarAvisos(avisos);
  if (contador.length === 0 && otros.length === 0) return null;

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      {contador.length > 0 ? (
        <Alert tone="info" title="Valores pendientes de confirmar con el contador">
          <ul className="list-disc space-y-0.5 pl-5">
            {contador.map((aviso, i) => (
              <li key={`${i}-${aviso}`}>{aviso}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {otros.length > 0 ? (
        <Alert tone="warning" title={titulo}>
          <ul className="list-disc space-y-0.5 pl-5">
            {otros.map((aviso, i) => (
              <li key={`${i}-${aviso}`}>{aviso}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}
