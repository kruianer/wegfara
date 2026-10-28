import type { Poi, PoiGegendFilter } from "./types";
import { GEGEND_FILTER_OHNE } from "./types";

/**
 * Die Gegenden einer Reise (req-095).
 *
 * Es gibt keine Tabelle fuer sie: Eine Gegend existiert genau so lange, wie
 * mindestens ein POI sie traegt. Wird sie beim letzten POI entfernt,
 * verschwindet sie aus der Liste -- ohne Aufraeumen, ohne verwaiste Zeile.
 * Die Liste wird deshalb immer aus den POIs selbst gelesen.
 */

/**
 * Wie viele Zeichen eine Gegend hoechstens hat (req-101). Die Gegend ist
 * keine Beschreibung, sondern ein Kuerzel wie "BIO" oder "SSE" -- so passt
 * sie in die feste Spalte der POI-Liste und der POI-Auswahl. Diese Zahl gilt
 * fuer das Formular, die Pruefung beim Speichern und den Datenzugriff.
 *
 * In der Datenbank steht dafuer bewusst keine Bedingung: Gegenden von vor
 * req-101 duerfen laenger sein und bleiben unveraendert. Eine Bedingung mit
 * "not valid" schonte sie nur beim Anlegen -- jedes spaetere update der Zeile
 * (Status, Kosten, Vervollstaendigen) pruefte sie erneut und schluege fehl.
 * Die Laenge traegt deshalb allein die Anwendungsschicht.
 */
export const GEGEND_MAX_LAENGE = 6;

/**
 * Was aus einer Eingabe wird: Raender weg, der leere Text zu null. Mehrfache
 * Leerzeichen innen werden zu einem -- "Rioja  Alavesa" und "Rioja Alavesa"
 * sollen nicht als zwei Gegenden dastehen.
 */
export function normalisiereGegend(wert: string | null): string | null {
  if (wert === null) return null;
  const sauber = wert.trim().replace(/\s+/g, " ");
  return sauber.length === 0 ? null : sauber;
}

/**
 * Ob die Eingabe -- aufgeraeumt -- laenger ist als ein Kuerzel sein darf
 * (req-101). Gekuerzt wird nie: aus "Bilbao Altstadt" wuerde geraten, was
 * gemeint war. Eine zu lange Gegend wird abgewiesen.
 */
export function gegendZuLang(wert: string | null): boolean {
  const sauber = normalisiereGegend(wert);
  return sauber !== null && sauber.length > GEGEND_MAX_LAENGE;
}

/**
 * Ob zwei Namen dieselbe Gegend meinen. Gross- und Kleinschreibung
 * entscheidet nicht: Wer "bilbao" tippt, soll zu "Bilbao" dazukommen und
 * keine zweite Gegend anlegen.
 */
export function gleicheGegend(a: string, b: string): boolean {
  return a.localeCompare(b, "de", { sensitivity: "accent" }) === 0;
}

/**
 * Die Gegenden dieser POIs, alphabetisch und ohne Wiederholung. Treten
 * mehrere Schreibweisen derselben Gegend auf, gilt die erste in
 * alphabetischer Folge -- so steht in der Liste ein Name und nicht zwei.
 */
export function gegendenAus(pois: Poi[]): string[] {
  const gefunden: string[] = [];
  for (const poi of pois) {
    const gegend = normalisiereGegend(poi.gegend ?? null);
    if (gegend === null) continue;
    if (gefunden.some((vorhanden) => gleicheGegend(vorhanden, gegend))) {
      continue;
    }
    gefunden.push(gegend);
  }
  return gefunden.sort((a, b) => a.localeCompare(b, "de"));
}

/** Ob mindestens ein POI eine Gegend traegt -- sonst gibt es nichts zu filtern. */
export function hatGegenden(pois: Poi[]): boolean {
  return pois.some((poi) => normalisiereGegend(poi.gegend ?? null) !== null);
}

/**
 * Ob ein POI dem Filter entspricht (req-095). Seit req-098 ist der Filter
 * eine Menge: die leere laesst jeden durch, sonst genuegt ein Eintrag --
 * "ohne" fuer die POIs ohne Gegend, jeder andere vergleicht den Namen.
 */
export function entsprichtGegendFilter(
  poi: Poi,
  filter: PoiGegendFilter,
): boolean {
  if (filter.length === 0) return true;

  const gegend = normalisiereGegend(poi.gegend ?? null);
  return filter.some((eintrag) => {
    if (eintrag === GEGEND_FILTER_OHNE) return gegend === null;
    return gegend !== null && gleicheGegend(gegend, eintrag);
  });
}

/**
 * Die POIs, die dem Filter entsprechen -- die Reihenfolge bleibt, wie sie
 * hereinkam.
 */
export function nachGegend(pois: Poi[], filter: PoiGegendFilter): Poi[] {
  if (filter.length === 0) return pois;
  return pois.filter((poi) => entsprichtGegendFilter(poi, filter));
}

/**
 * Der Filter ohne die Gegenden, die es nicht mehr gibt: Wurde eine gefilterte
 * Gegend beim letzten POI entfernt, fiele sonst jeder POI durch -- die Liste
 * zeigte dauerhaft nichts an (req-095). "ohne" gilt immer.
 */
export function geltenderGegendFilter(
  filter: PoiGegendFilter,
  pois: Poi[],
): PoiGegendFilter {
  const vorhandene = gegendenAus(pois);
  return filter.filter(
    (eintrag) =>
      eintrag === GEGEND_FILTER_OHNE ||
      vorhandene.some((gegend) => gleicheGegend(gegend, eintrag)),
  );
}

/**
 * Was die POI-Liste fuer die Gegend eines POI zeigt (req-097): die Gegend
 * selbst. Seit req-101 ist sie das Kuerzel -- einen Langnamen dazu gibt es
 * nicht, beim Ueberfahren erscheint deshalb nichts weiter. Ohne Gegend steht
 * "—". Eine laengere Gegend von frueher steht, wie sie ist; die Spalte
 * schneidet sie ab.
 */
export function gegendInDerListe(poi: Pick<Poi, "gegend">): {
  text: string;
  titel?: string;
  leer: boolean;
} {
  const gegend = normalisiereGegend(poi.gegend ?? null);
  if (gegend === null) {
    return { text: "—", titel: "Keine Gegend", leer: true };
  }
  return { text: gegend, leer: false };
}
