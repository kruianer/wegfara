import type { Poi, PoiPhoto, PoiPhotoSource } from "./types";
import { POI_TYPE_LABEL } from "./type-meta";

/**
 * Das von der KI erzeugte Bild eines POI (req-072).
 *
 * Ein POI von Hand — eine Wanderung, ein Aussichtspunkt, ein Lokal ohne
 * Google-Eintrag — bleibt sonst bildlos, bis jemand dort war. Aus Titel und
 * Beschreibung laesst sich vorher eines erzeugen.
 *
 * Hier steht, was ein solches Bild ausmacht: woran es zu erkennen ist (seine
 * Herkunft in der Datenbank) und was der KI aufgetragen wird. Beides ohne
 * UI-Bezug und ohne SDK — die Aufforderung ist eine reine Funktion ihrer
 * Vorlage und laesst sich fuer sich pruefen.
 */

/** Die Herkunft eines erzeugten Bildes (`poi_photo.source`). */
export const KI_BILD_QUELLE: PoiPhotoSource = "ki";

/**
 * Ob dieses Foto von der KI erzeugt wurde — die einzige Stelle, an der
 * darueber entschieden wird. Gefragt wird die Herkunft aus der Datenbank,
 * nie der Dateiname (req-072, Constraints).
 */
export function istKiBild(photo: PoiPhoto): boolean {
  return photo.source === KI_BILD_QUELLE;
}

/**
 * Das Symbol, das ein KI-Bild kennzeichnet — an jeder Stelle dasselbe: ein
 * Stern, die beiden Buchstaben und der Titel, den Vorlesehilfen ansagen.
 */
export const KI_BILD_SYMBOL_ZEICHEN = "✦";
export const KI_BILD_SYMBOL_TEXT = "KI";
export const KI_BILD_SYMBOL_TITEL = "Mit KI erzeugt";

/**
 * Was die Oberflaeche sagt, wenn das Erzeugen fehlschlug, ohne dass ein
 * Grund zurueckkam — etwa weil die Anfrage gar nicht erst hinausging. Nennt
 * die Antwort einen Grund, steht dieser da und nicht dieser Satz (bug-021).
 */
export const KI_BILD_FEHLGESCHLAGEN =
  "Das Bild konnte nicht erzeugt werden. Bitte später erneut versuchen.";

/** Die Vorlage des Bildes: Titel und Beschreibung des POI, sonst nichts. */
export interface KiBildVorlage {
  name: string;
  ort?: string;
  type: Poi["type"];
  shortText?: string;
  longText?: string;
}

/** Die Vorlage eines gespeicherten POI — mehr braucht das Erzeugen nicht. */
export function kiBildVorlage(poi: Poi): KiBildVorlage {
  return {
    name: poi.name,
    ort: poi.ort,
    type: poi.type,
    shortText: poi.shortText,
    longText: poi.longText,
  };
}

function gefuellt(text: string | undefined): string | null {
  const wert = (text ?? "").trim();
  return wert.length > 0 ? wert : null;
}

/**
 * Was der KI aufgetragen wird (req-072).
 *
 * Zwei Dinge stehen immer darin: der Ort, um den es geht — Titel, Typ und,
 * wenn bekannt, die Gegend —, und die Forderung nach einer Aufnahme. Das
 * Bild soll aussehen wie eine Fotografie des Ortes und nicht wie eine
 * Zeichnung, ein Gemaelde oder eine stilisierte Darstellung; deshalb steht
 * das ausdruecklich in der Aufforderung und nicht nur in der Hoffnung.
 *
 * Die Beschreibung kommt dazu, wenn es eine gibt. Fehlt sie, entsteht das
 * Bild aus dem Titel allein — nichts bleibt dabei stillschweigend leer.
 */
export function kiBildAufforderung(vorlage: KiBildVorlage): string {
  const ort = gefuellt(vorlage.ort);
  const kurz = gefuellt(vorlage.shortText);
  const lang = gefuellt(vorlage.longText);

  const gegenstand = [
    `Fotorealistische Aufnahme von „${vorlage.name.trim()}“`,
    `(${POI_TYPE_LABEL[vorlage.type]})`,
    ort ? `in ${ort}` : null,
  ]
    .filter((teil) => teil !== null)
    .join(" ");

  const beschreibung = [kurz, lang].filter((teil) => teil !== null).join(" ");

  return [
    `${gegenstand}.`,
    beschreibung.length > 0 ? `Dazu ist bekannt: ${beschreibung}` : null,
    "Das Bild soll wirken wie eine echte Fotografie dieses Ortes: natürliches Licht, echte Materialien, glaubwürdige Perspektive und Tiefenschärfe einer Kamera.",
    "Keine Zeichnung, kein Gemälde, keine Illustration, keine Collage, keine stilisierte oder künstlerisch verfremdete Darstellung. Keine Schrift, keine Beschriftung, kein Wasserzeichen und kein Rahmen im Bild.",
  ]
    .filter((teil) => teil !== null)
    .join("\n");
}
