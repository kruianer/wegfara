import type { Wegabschnitt } from "@/lib/routing/client";

/**
 * Die Wegbeschreibung einer Strecke (req-059): hoechstens fuenf Zeilen mit
 * den Abschnitten der Route, je Zeile die Strasse und ihre Laenge -- etwa
 * "SS163, 8 km". Sie dient dem Einschaetzen, nicht dem Navigieren; navigiert
 * wird in Google Maps (siehe vision.md).
 *
 * Eine Route besteht aus vielen kleinen Abschnitten. Zusammengehoerende
 * Stuecke derselben Strasse werden zu einem zusammengefasst; uebrig bleiben
 * die fuenf laengsten, in der Reihenfolge der Fahrt.
 */
export const WEGBESCHREIBUNG_MAX_ZEILEN = 5;

/** Wie ein Abschnitt heisst, dessen Strasse der Dienst nicht benennt. */
const OHNE_NAMEN = "Weg ohne Namen";

export function wegbeschreibung(abschnitte: Wegabschnitt[] = []): string[] {
  return laengste(zusammengefasst(abschnitte)).map(
    (abschnitt) =>
      `${abschnitt.strasse || OHNE_NAMEN}, ${formatLaenge(abschnitt.distanzKm)}`,
  );
}

/** Aufeinanderfolgende Abschnitte derselben Strasse werden zu einem. */
function zusammengefasst(abschnitte: Wegabschnitt[]): Wegabschnitt[] {
  const zusammen: Wegabschnitt[] = [];
  for (const abschnitt of abschnitte) {
    const letzter = zusammen[zusammen.length - 1];
    if (letzter && letzter.strasse === abschnitt.strasse) {
      letzter.distanzKm += abschnitt.distanzKm;
      continue;
    }
    zusammen.push({ ...abschnitt });
  }
  return zusammen;
}

/**
 * Die fuenf laengsten Abschnitte, aber in der Reihenfolge der Fahrt: sie
 * praegen die Strecke, die vielen kurzen dazwischen sagen wenig.
 */
function laengste(abschnitte: Wegabschnitt[]): Wegabschnitt[] {
  if (abschnitte.length <= WEGBESCHREIBUNG_MAX_ZEILEN) return abschnitte;

  const ausgewaehlt = new Set(
    [...abschnitte.keys()]
      .sort((a, b) => abschnitte[b].distanzKm - abschnitte[a].distanzKm)
      .slice(0, WEGBESCHREIBUNG_MAX_ZEILEN),
  );
  return abschnitte.filter((_, index) => ausgewaehlt.has(index));
}

/** Unter einem Kilometer in Metern, darueber mit einer Nachkommastelle. */
function formatLaenge(distanzKm: number): string {
  if (distanzKm < 1) return `${Math.max(10, Math.round(distanzKm * 1000))} m`;

  return `${distanzKm.toFixed(1).replace(".", ",")} km`;
}
