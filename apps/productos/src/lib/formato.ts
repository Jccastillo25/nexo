export function formatoCosto(valor: number | null | undefined, moneda: "NIO" | "USD" | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const simbolo = moneda === "USD" ? "US$" : "C$";
  return `${simbolo} ${Number(valor).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
