/**
 * Datumsangaben des Bereichs "Nutzer" (req-038) -- Beitritt, letzte
 * Anmeldung und der Ablauf einer offenen Einladung.
 */

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** z.B. "04.09.2026"; ein fehlendes Datum wird zum Gedankenstrich. */
export function formatDay(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${twoDigits(date.getDate())}.${twoDigits(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** z.B. "04.09.2026, 18:30" -- fuer Ablauf und letzte Verwendung. */
export function formatMoment(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDay(iso)}, ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}
