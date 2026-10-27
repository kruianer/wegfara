/**
 * Warum eine Anfrage an das Sprachmodell nicht zustande kam (bug-032).
 *
 * Bis dahin lieferte die Schnittstelle bei jedem Fehlschlag null, und die
 * Oberflaeche schrieb "Die Suche ist fehlgeschlagen." Wer das las, suchte
 * den Fehler bei seinem Zugangsschluessel — auch dann, wenn der in Ordnung
 * war und in Wahrheit der Modellname fehlte (vgl. bug-021, bug-026).
 *
 * Der Typ steht in einem eigenen Modul ohne SDK-Bezug: die Oberflaeche
 * braucht ihn und seinen Text, das Abbilden der Antwort des Dienstes darauf
 * gehoert zum jeweiligen Anbieter (lib/ai/openai-client.ts).
 */
export type AiFehlerArt =
  /** Der Dienst kennt das eingestellte Modell nicht — oder es kam keins an. */
  | "modell"
  /** Der Zugangsschluessel wurde abgelehnt. */
  | "zugang"
  /** Kein Guthaben mehr oder zu viele Anfragen in zu kurzer Zeit. */
  | "kontingent"
  /** Der Dienst hat die Anfrage aus einem anderen Grund abgewiesen. */
  | "anfrage"
  /** Der Dienst selbst hat gerade eine Stoerung. */
  | "dienst"
  /** Der Dienst war nicht erreichbar. */
  | "netz"
  /** Der Dienst hat geantwortet, aber ohne Inhalt. */
  | "leer"
  /**
   * Die Antwort hat die Token-Grenze erreicht, bevor sie fertig war
   * (bug-061) -- Nachdenken und Antworttext zaehlen beim Dienst gemeinsam
   * gegen diese Grenze, auch wenn das Nachdenken nicht ausgeliefert wird.
   */
  | "abgeschnitten";

export interface AiFehler {
  art: AiFehlerArt;
  /**
   * Was der Dienst selbst dazu sagt, in seinen Worten. Gehoert ins Log und
   * hinter den Satz an den Nutzer — er ist der einzige Hinweis, der genau
   * benennt, was fehlt ("you must provide a model parameter").
   */
  detail: string;
}

/**
 * Was der Nutzer dazu liest. Jeder Satz sagt, ob sein Zugangsschluessel die
 * Ursache ist — genau daran scheiterte die Meldung bisher.
 */
export const AI_FEHLER_TEXT: Record<AiFehlerArt, string> = {
  modell:
    "Der KI-Dienst hat das eingestellte Modell abgelehnt — es fehlt oder ist ihm unbekannt. Nicht der Zugangsschlüssel ist die Ursache; bitte dem Betreiber melden.",
  zugang:
    "Der KI-Dienst hat den Zugangsschlüssel abgelehnt. Bitte ihn in „Mein Bereich“ prüfen und neu hinterlegen.",
  kontingent:
    "Der Zugangsschlüssel hat kein Guthaben mehr, oder es kamen zu viele Anfragen in zu kurzer Zeit. Bitte später erneut versuchen.",
  anfrage:
    "Der KI-Dienst hat die Anfrage abgelehnt. Nicht der Zugangsschlüssel ist die Ursache; bitte dem Betreiber melden.",
  dienst:
    "Der KI-Dienst hat gerade eine Störung. Nicht der Zugangsschlüssel ist die Ursache; bitte später erneut versuchen.",
  netz: "Der KI-Dienst war nicht erreichbar. Nicht der Zugangsschlüssel ist die Ursache; bitte später erneut versuchen.",
  leer: "Der KI-Dienst hat nichts geantwortet. Bitte erneut versuchen.",
  abgeschnitten:
    "Die Antwort ist zu lang geworden und wurde abgeschnitten. Bitte die Frage enger fassen oder erneut versuchen.",
};

/**
 * Was von einem Fehlschlag im Log steht. Der Zugangsschluessel steht nie
 * darin — die Antworten der Dienste geben ihn nicht wieder, und gefragt
 * wird hier auch nicht danach.
 */
export function aiFehlerLogZeile(fehler: AiFehler): string {
  return `[ki] Anfrage fehlgeschlagen (${fehler.art}): ${fehler.detail}`;
}

/**
 * Warum eine Web-Suche waehrend einer Antwort des Chats scheiterte (req-092).
 * Anders als ein AiFehler bricht sie die Antwort nicht ab: das Modell
 * schreibt weiter, und der Grund steht unter dem, was kam -- dasselbe
 * Muster wie bei "refusal" und "max_tokens", nur dass hier die Antwort
 * stehen bleibt.
 */
export type WebSucheFehlerArt =
  /** Die Grenze der Suchen je Antwort war erreicht (max_uses). */
  | "grenze"
  /** Zu viele Suchen in zu kurzer Zeit. */
  | "ueberlastet"
  /** Die Suche war beim Dienst gerade nicht verfuegbar. */
  | "dienst"
  /** Der Dienst hat die Suchanfrage abgewiesen (zu lang, ungueltig). */
  | "anfrage";

export const WEB_SUCHE_FEHLER_ARTEN: readonly WebSucheFehlerArt[] = [
  "grenze",
  "ueberlastet",
  "dienst",
  "anfrage",
];

/** Was der Nutzer unter der Antwort liest. */
export const WEB_SUCHE_FEHLER_TEXT: Record<WebSucheFehlerArt, string> = {
  grenze:
    "Die Grenze der Web-Suchen für diese Antwort war erreicht — weitere Suchen blieben aus.",
  ueberlastet:
    "Eine Web-Suche schlug fehl: zu viele Suchen in zu kurzer Zeit. Die Antwort beruht nur auf dem, was bis dahin gefunden war.",
  dienst:
    "Eine Web-Suche schlug fehl: die Suche war beim KI-Dienst gerade nicht verfügbar. Die Antwort beruht nur auf dem, was bis dahin gefunden war.",
  anfrage:
    "Eine Web-Suche schlug fehl: der KI-Dienst hat die Suchanfrage abgewiesen. Die Antwort beruht nur auf dem, was bis dahin gefunden war.",
};
