import type { KatalogModell } from "../ai/modell-katalog";

/**
 * Welche Modelle im Chat des Planers zur Wahl stehen (req-090). Die Modelle
 * selbst stehen nicht im Quelltext: der Dienst nennt sie (siehe
 * lib/ai/modell-katalog.ts), und eine Liste hier veraltete unbemerkt -- die
 * bis req-090 gefuehrte war es schon. Was daraus in die Auswahl kommt,
 * entscheidet allein diese Datei.
 *
 * Alle kommen von Anthropic und werden ueber den Zugangsschluessel der Art
 * `anthropic` abgerechnet (req-028). Der Schluessel `ki_suche` ist ein
 * OpenAI-Schluessel und taugt dafuer nicht.
 */

export interface ChatModell {
  /** Die Kennung, unter der der Dienst das Modell kennt. */
  id: string;
  /** Der Name des Dienstes -- er steht in der Auswahl, nicht die Kennung. */
  name: string;
  /** Die Reihe aus dem Feld des Dienstes, nie aus der Kennung geraten. */
  reihe: string | null;
  /** Die Groesse des Kontextfensters in Token -- null, wenn unbekannt. */
  kontextTokens: number | null;
}

/**
 * Die Modelle, die zur Wahl stehen: nur die aktiven, in der Reihenfolge des
 * Dienstes (die neueren zuerst). Ein abgeschaltetes ("retired") laesst sich
 * nicht mehr aufrufen, ein abgekuendigtes ("deprecated") ist auf dem Weg
 * dorthin -- beide gehoeren nicht in eine Auswahl, in der man sich gerade
 * entscheidet.
 */
export function waehlbareChatModelle(katalog: KatalogModell[]): ChatModell[] {
  return katalog
    .filter((modell) => modell.lebenslauf === "active")
    .map((modell) => ({
      id: modell.id,
      name: modell.name,
      reihe: modell.reihe,
      kontextTokens: modell.maxEingabeTokens,
    }));
}

/** Die Reihe, mit der eine Unterhaltung beginnt: die ausgewogene Mitte. */
export const VORGEWAEHLTE_REIHE = "sonnet";

/**
 * Das Modell, mit dem eine Unterhaltung beginnt: das neueste der Reihe
 * Sonnet -- der Dienst nennt die neueren zuerst --, sonst das erste der
 * Liste. null nur, wenn gar keines zur Wahl steht.
 */
export function vorgewaehltesChatModell(modelle: ChatModell[]): string | null {
  return (
    modelle.find((modell) => modell.reihe === VORGEWAEHLTE_REIHE)?.id ??
    modelle[0]?.id ??
    null
  );
}

/**
 * Wie eine Kennung aussieht, die an den Dienst gehen darf. Mehr wird ohne
 * Katalog nicht geprueft: faellt der Katalog aus, darf das den Chat nicht
 * scheitern lassen (req-090, Constraints) -- ein unbekanntes Modell lehnt
 * der Dienst dann selbst ab, mit Grund.
 */
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

/**
 * Ob mit dieser Kennung gefragt werden darf. Ist der Katalog bekannt, muss sie
 * darin zur Wahl stehen; ist er es nicht, genuegt eine wohlgeformte Kennung.
 */
export function istChatModell(
  value: unknown,
  modelle: ChatModell[] | null = null,
): value is string {
  if (typeof value !== "string" || !KENNUNG.test(value)) return false;
  return modelle === null || modelle.some((modell) => modell.id === value);
}

/**
 * Wie die Kennung des Modells im Verlauf dasteht: Welche Antwort von welchem
 * Modell kam, soll ablesbar sein (req-081). Eine Kennung, die der Katalog
 * nicht (mehr) nennt, bleibt stehen, wie sie ist -- eine Antwort aus einem
 * abgeloesten Modell soll ihre Herkunft nicht verlieren.
 */
export function chatModellLabel(
  id: string,
  modelle: ChatModell[] | null,
): string {
  return modelle?.find((modell) => modell.id === id)?.name ?? id;
}

const TOKEN_ZAHL = new Intl.NumberFormat("de-DE");

/**
 * Die Beschriftung in der Auswahl: der Name des Dienstes und, wo bekannt,
 * seine Zahl fuer das Kontextfenster -- kein Urteil wie "stark, teuer", das
 * der Dienst nicht liefert und bei einem neuen Modell wieder geraten waere.
 */
export function chatModellBeschriftung(modell: ChatModell): string {
  if (modell.kontextTokens === null) return modell.name;
  return `${modell.name} — ${TOKEN_ZAHL.format(modell.kontextTokens)} Token Kontext`;
}
