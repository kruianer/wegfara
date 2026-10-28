import type { AiClient } from "../ai/client";
import type { AiFehler } from "../ai/fehler";
import type { DruckTag } from "./types";

/**
 * Die Ueberschriften der Reisetage auf Seite 2 (req-103): "Guggenheim und
 * Altstadt" statt "Guggenheim-Museum, Casco Viejo, Puente colgante".
 *
 * Die KI schlaegt sie auf Knopfdruck vor; gespeichert wird das Ergebnis, und
 * was jemand von Hand schreibt, bleibt stehen. Ohne gespeicherte Ueberschrift
 * stehen die Orte des Tages verbunden da -- der Plan ist nie kaputt, nur
 * weniger schoen (vgl. bug-067).
 *
 * **Die Zahlen bekommt die KI nicht.** Stationen, Kilometer und Kosten kommen
 * aus den Daten; sie sieht nur die Namen der Stationen und ihre Orte.
 */

/** Eine gespeicherte Ueberschrift eines Reisetags. */
export interface TagesUeberschrift {
  tripId: string;
  /** Der Reisetag (ISO-Datum). */
  datum: string;
  text: string;
  /** Von Hand geschrieben -- die KI ruehrt sie nicht mehr an. */
  vonHand: boolean;
}

/** Hoechstens so lang darf eine Ueberschrift sein -- sie steht in einer Zeile. */
export const TAGES_UEBERSCHRIFT_MAX_LENGTH = 60;

/** Was die Oberflaeche sagt, wenn das Erzeugen ohne Grund scheiterte. */
export const UEBERSCHRIFTEN_FEHLGESCHLAGEN =
  "Die Überschriften konnten nicht erzeugt werden. Bitte später erneut versuchen.";

/** Was die KI je Tag zu sehen bekommt: Namen, keine Zahlen. */
export interface UeberschriftVorlage {
  datum: string;
  stationen: string[];
  orte: string[];
}

export function ueberschriftVorlagen(tage: DruckTag[]): UeberschriftVorlage[] {
  return tage
    .filter((tag) => tag.stationen.length > 0)
    .map((tag) => ({
      datum: tag.datum,
      stationen: tag.stationen.map((station) => station.name),
      orte: [
        ...new Set(
          tag.stationen.map((station) => station.ort.trim()).filter(Boolean),
        ),
      ],
    }));
}

/** Die Aufforderung an die KI -- je Tag seine Stationen und Orte. */
export function ueberschriftenAufforderung(
  vorlagen: UeberschriftVorlage[],
): string {
  const tage = vorlagen.map((vorlage) => ({
    datum: vorlage.datum,
    stationen: vorlage.stationen,
    orte: vorlage.orte,
  }));
  return [
    "Du schreibst die Überschriften der Reisetage für einen gedruckten Reiseplan.",
    "Je Tag eine kurze, sprechende Überschrift auf Deutsch, höchstens 40 Zeichen — etwa „Guggenheim und Altstadt“ statt einer Aufzählung aller Stationen.",
    "Keine Zahlen, keine Uhrzeiten, keine Preise, keine Entfernungen, keine Anführungszeichen.",
    'Antworte nur mit JSON in dieser Form: {"tage": [{"datum": "YYYY-MM-DD", "ueberschrift": "…"}]}',
    "Die Tage:",
    JSON.stringify(tage),
  ].join("\n");
}

/**
 * Liest die Antwort der KI. Nur Tage, die gefragt waren, und nur Text, der
 * in eine Zeile passt -- alles andere wird uebergangen.
 */
export function leseUeberschriften(
  antwort: string,
  daten: string[],
): { datum: string; text: string }[] {
  const start = antwort.indexOf("{");
  const ende = antwort.lastIndexOf("}");
  if (start < 0 || ende <= start) return [];
  let geparst: unknown;
  try {
    geparst = JSON.parse(antwort.slice(start, ende + 1));
  } catch {
    return [];
  }
  const tage = (geparst as { tage?: unknown })?.tage;
  if (!Array.isArray(tage)) return [];

  const gefragt = new Set(daten);
  const ergebnis = new Map<string, string>();
  for (const eintrag of tage) {
    const datum = (eintrag as { datum?: unknown })?.datum;
    const text = (eintrag as { ueberschrift?: unknown })?.ueberschrift;
    if (typeof datum !== "string" || typeof text !== "string") continue;
    const sauber = text
      .trim()
      .replace(/^["„“”]+|["„“”]+$/g, "")
      .trim();
    if (
      !gefragt.has(datum) ||
      sauber.length === 0 ||
      sauber.length > TAGES_UEBERSCHRIFT_MAX_LENGTH
    ) {
      continue;
    }
    ergebnis.set(datum, sauber);
  }
  return [...ergebnis].map(([datum, text]) => ({ datum, text }));
}

export type UeberschriftenAntwort =
  | { ok: true; ueberschriften: { datum: string; text: string }[] }
  | { ok: false; fehler: AiFehler | null };

/** Fragt die KI nach den Ueberschriften der Tage mit Stationen. */
export async function schlageUeberschriftenVor(
  client: AiClient,
  tage: DruckTag[],
): Promise<UeberschriftenAntwort> {
  const vorlagen = ueberschriftVorlagen(tage);
  if (vorlagen.length === 0) return { ok: true, ueberschriften: [] };

  const antwort = await client.complete(ueberschriftenAufforderung(vorlagen));
  if (!antwort.ok) return { ok: false, fehler: antwort.fehler };

  const ueberschriften = leseUeberschriften(
    antwort.text,
    vorlagen.map((v) => v.datum),
  );
  return ueberschriften.length > 0
    ? { ok: true, ueberschriften }
    : { ok: false, fehler: null };
}
