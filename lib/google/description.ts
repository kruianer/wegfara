import { POI_SHORT_TEXT_MAX_LENGTH } from "@/lib/pois/validate";

/** Kurz- und Langtext eines POI, wie sie aus den Google-Angaben entstehen. */
export interface PoiTexts {
  shortText?: string;
  longText?: string;
}

/**
 * Die Beschreibung eines POI aus den Google-Angaben (req-044): Google fuehrt
 * zu einem Ort genau einen beschreibenden Text. Er wird zum Langtext, der
 * unbegrenzt ist; der Kurztext ist sein Anfang, gekuerzt auf die Grenze, die
 * die POI-Liste zusammenhaelt.
 *
 * Ohne Beschreibung bleiben beide leer -- ein Platzhalter waere schlechter
 * als nichts, denn er ueberdeckte den Platz fuer eigene Notizen.
 */
export function poiTextsFromGoogle(description: string | undefined): PoiTexts {
  const text = description?.trim() ?? "";
  if (text.length === 0) return {};
  return { shortText: gekuerzt(text), longText: text };
}

/** Auf die Grenze gekuerzt, moeglichst am letzten ganzen Wort davor. */
function gekuerzt(text: string): string {
  if (text.length <= POI_SHORT_TEXT_MAX_LENGTH) return text;
  const anfang = text.slice(0, POI_SHORT_TEXT_MAX_LENGTH - 1);
  const letzteLuecke = anfang.lastIndexOf(" ");
  const stumpf = letzteLuecke > 0 ? anfang.slice(0, letzteLuecke) : anfang;
  return `${stumpf.trimEnd()}…`;
}
