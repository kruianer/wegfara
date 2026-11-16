import type { ApiKeyKind } from "../api-keys/types";

/**
 * Wofuer ein Account ein KI-Modell waehlt (req-108). Drei Zwecke, je einer
 * je Feld der Karte "KI-Modelle".
 */
export const KI_ZWECKE = ["fragen", "bilder", "chat"] as const;

export type KiZweck = (typeof KI_ZWECKE)[number];

export function istKiZweck(value: unknown): value is KiZweck {
  return typeof value === "string" && KI_ZWECKE.includes(value as KiZweck);
}

/** Wie die Karte die Felder benennt. */
export const KI_ZWECK_LABEL: Record<KiZweck, string> = {
  fragen: "Fragen",
  bilder: "Bilder",
  chat: "Chat im Planer",
};

/**
 * Wofuer das Feld gilt -- die Karte sagt es, denn der Katalog von OpenAI
 * trennt Bild- und Textmodelle nicht (req-108).
 */
export const KI_ZWECK_ERKLAERUNG: Record<KiZweck, string> = {
  fragen:
    "Für die KI-Suche nach POIs, die Beschreibung eines POI und das Planen mit KI.",
  bilder: "Für das Bild zu einem POI und das Titelfoto einer Reise.",
  chat: "Womit eine Unterhaltung im Chat des Planers beginnt. Im Chat lässt es sich weiter umstellen.",
};

/** Ueber welchen Zugangsschluessel der Zweck abgerechnet wird (req-028). */
export const KI_ZWECK_SCHLUESSEL: Record<KiZweck, ApiKeyKind> = {
  fragen: "ki_suche",
  bilder: "ki_suche",
  chat: "anthropic",
};

/** Was ein Account gewaehlt hat -- null heisst: nichts gewaehlt. */
export type KiModellWahl = Record<KiZweck, string | null>;

export const KEINE_WAHL: KiModellWahl = {
  fragen: null,
  bilder: null,
  chat: null,
};

/**
 * Wie eine Kennung aussieht, die gespeichert werden darf -- dieselbe Regel
 * wie fuer die Kennung im Chat (lib/chat/modelle.ts).
 */
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

export function istModellKennung(value: unknown): value is string {
  return typeof value === "string" && KENNUNG.test(value);
}

/** Ein Eintrag der Auswahl, wie die Karte ihn zeigt. */
export interface KiModellEintrag {
  /** Die Kennung -- sie wird gespeichert. */
  id: string;
  /** Der Name des Dienstes; bei OpenAI die Kennung, einen anderen nennt er nicht. */
  name: string;
  /** "YYYY-MM-DD", wenn der Dienst das Modell abschalten wird -- sonst null. */
  abschaltungAm: string | null;
}

/** Der Stand eines Feldes der Karte "KI-Modelle" (req-108). */
export interface KiModellFeld {
  zweck: KiZweck;
  /** Was der Account gewaehlt hat -- null heisst: nichts gewaehlt. */
  gewaehlt: string | null;
  /**
   * Was ohne Wahl gilt: bei OpenAI die Umgebung, sonst der Standard im
   * Quelltext; im Chat das, womit eine Unterhaltung sonst beginnt. null, wenn
   * es ohne Katalog nicht zu sagen ist.
   */
  ohneWahl: string | null;
  /** Die Modelle, die der Dienst nennt -- null, wenn keine Liste da ist. */
  modelle: KiModellEintrag[] | null;
  /**
   * Warum keine Liste da ist: "schluessel" -- kein Zugangsschluessel
   * hinterlegt --, "dienst" -- der Dienst antwortet nicht, und gemerkt ist
   * nichts. null, wenn eine Liste da ist.
   */
  grund: "schluessel" | "dienst" | null;
  /**
   * Wann die Liste geholt wurde (ISO), wenn sie nur noch gemerkt ist, weil
   * der Dienst gerade nicht antwortet. null, wenn sie frisch ist.
   */
  gemerktAm: string | null;
  /**
   * Das eingestellte Modell, wenn der Dienst es nicht mehr zur Wahl nennt --
   * der Fall von bug-076. null, wenn es dasteht oder keine Liste da ist.
   */
  verschwunden: string | null;
}
