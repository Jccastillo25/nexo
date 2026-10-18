/** Fecha de hoy en Nicaragua (America/Managua), en formato YYYY-MM-DD. */
export function hoyManagua() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(key => parts.find(p => p.type === key)!.value).join("-");
}
