/**
 * Die lokale Zeit als "YYYY-MM-DDTHH:mm" -- dieselbe Form, in der Beginn
 * und Ende eines Programmpunkts stehen (siehe lib/activities/types.ts).
 * Gerechnet wird in der Zeitzone des Geraets bzw. des Servers; eine eigene
 * Reisezeitzone gibt es (noch) nicht.
 */
export function lokaleZeit(date: Date): string {
  const jahr = date.getFullYear();
  const monat = String(date.getMonth() + 1).padStart(2, "0");
  const tag = String(date.getDate()).padStart(2, "0");
  const stunde = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${jahr}-${monat}-${tag}T${stunde}:${minute}`;
}

/** Die Uhrzeit "HH:mm" aus einer lokalen Zeit "YYYY-MM-DDTHH:mm". */
export function uhrzeit(lokal: string): string {
  return lokal.slice(11, 16);
}
