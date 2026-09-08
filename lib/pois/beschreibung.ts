import type { AiClient } from "@/lib/ai/client";
import { POI_SHORT_TEXT_MAX_LENGTH } from "./validate";
import { POI_TYPE_LABEL } from "./type-meta";
import type { PoiType } from "./types";

/**
 * Die Beschreibung eines Ortes, von der KI vorgeschlagen (req-058).
 *
 * Sie wird nur auf Knopfdruck geholt -- jeder Lauf kostet ueber den
 * Zugangsschluessel des Accounts (req-028). Der Vorschlag landet in den
 * Feldern und ist dort aenderbar; gespeichert wird erst, was der Nutzer
 * stehen laesst.
 */
export interface Beschreibung {
  shortText: string;
  longText: string;
}

/** Woruem gebeten wird -- der Ort, so gut ihn das Formular schon kennt. */
export interface BeschreibungsAnfrage {
  name: string;
  type: PoiType;
  /** Der abgeleitete Ort, falls schon bekannt (req-041). */
  ort?: string;
  /** Die Adresse, falls eingetragen -- sie macht den Ort eindeutig. */
  address?: string;
}

export function beschreibungsPrompt(anfrage: BeschreibungsAnfrage): string {
  const woran = [anfrage.address, anfrage.ort].filter(Boolean).join(", ");
  return [
    `Beschreibe diesen Ort fuer die Planung einer Reise:`,
    `Name: ${anfrage.name}`,
    `Art: ${POI_TYPE_LABEL[anfrage.type]}`,
    woran.length > 0 ? `Wo: ${woran}` : null,
    "",
    `Schlage im Web nach, wenn du den Ort nicht sicher kennst.`,
    `Antworte ausschliesslich als JSON-Objekt der Form`,
    `{"kurz": "...", "lang": "..."} ohne weiteren Text.`,
    `"kurz" fasst den Ort in hoechstens ${POI_SHORT_TEXT_MAX_LENGTH} Zeichen,`,
    `"lang" in zwei bis vier Saetzen: was es dort gibt und warum man hingeht.`,
    `Schreibe auf Deutsch. Erfinde nichts -- was du nicht weisst, laesst du weg.`,
  ]
    .filter((zeile) => zeile !== null)
    .join("\n");
}

/**
 * Liest den Vorschlag aus der Antwort. Ein Modell packt sein JSON gern in
 * einen Codeblock -- deshalb wird das Objekt gesucht, statt die ganze
 * Antwort zu erwarten.
 */
export function parseBeschreibung(raw: string): Beschreibung | null {
  const start = raw.indexOf("{");
  const ende = raw.lastIndexOf("}");
  if (start < 0 || ende <= start) return null;

  let daten: unknown;
  try {
    daten = JSON.parse(raw.slice(start, ende + 1));
  } catch {
    return null;
  }

  const objekt = daten as { kurz?: unknown; lang?: unknown };
  const kurz = typeof objekt.kurz === "string" ? objekt.kurz.trim() : "";
  const lang = typeof objekt.lang === "string" ? objekt.lang.trim() : "";
  if (kurz.length === 0 && lang.length === 0) return null;

  return {
    // Ein zu langer Kurztext wuerde die POI-Zeile sprengen und beim
    // Speichern abgewiesen -- lieber gekuerzt als verworfen.
    shortText: kurz.slice(0, POI_SHORT_TEXT_MAX_LENGTH),
    longText: lang,
  };
}

/**
 * Der Vorschlag zu einem Ort, oder null, wenn die KI nichts Brauchbares
 * geliefert hat. Ein Fehlschlag bleibt ein Fehlschlag -- er wird nicht durch
 * einen erfundenen Text ersetzt.
 */
export async function schlageBeschreibungVor(
  ai: AiClient,
  anfrage: BeschreibungsAnfrage,
): Promise<Beschreibung | null> {
  const antwort = await ai.completeWithWebSearch(beschreibungsPrompt(anfrage));
  return antwort ? parseBeschreibung(antwort) : null;
}
