/**
 * Warum die Fotos eines Ortes aus Google nicht (vollstaendig) beim POI
 * gelandet sind (bug-027).
 *
 * Bis dahin verschwand jeder dieser Faelle stillschweigend: der POI entstand
 * mit Name, Adresse und Position, die Bilder fehlten -- und niemand sagte,
 * warum. Genau das darf es nicht geben (bug-021).
 *
 * Der Typ steht bewusst in einem eigenen Modul ohne Datenbank- und
 * Dateisystem-Bezug: die Oberflaeche braucht ihn und seinen Text, das
 * Uebernehmen selbst (lib/pois/google-photos.ts) laeuft nur auf dem Server.
 */
export type GoogleFotoProblem =
  /** Die Bildablage ist gar nicht nutzbar -- kein Bild kann entstehen. */
  | "ablage_fehlt"
  /** Ein geholtes Bild liess sich nicht in die Ablage schreiben. */
  | "nicht_gespeichert"
  /** Google hat ein angekuendigtes Bild nicht herausgegeben. */
  | "nicht_geholt";

/**
 * Was der Nutzer dazu liest. Die Texte nennen den Ort der Ablage nicht --
 * sie stehen in der Oberflaeche und sagen, was fehlt und wer helfen kann.
 * Sie passen bewusst auf beide Wege, ueber die Fotos entstehen: den POI aus
 * einem Google-Maps-Link (req-026) und die KI-Suche (req-057).
 */
export const GOOGLE_FOTO_PROBLEM_TEXT: Record<GoogleFotoProblem, string> = {
  ablage_fehlt:
    "Die Bilder aus Google konnten nicht abgelegt werden: Die Bildablage ist nicht beschreibbar. Bitte dem Betreiber melden.",
  nicht_gespeichert:
    "Mindestens ein Bild aus Google ließ sich nicht ablegen. Bitte dem Betreiber melden.",
  nicht_geholt: "Mindestens ein Bild hat Google nicht herausgegeben.",
};

/**
 * Ob das, was aus der Schnittstelle kommt, ein bekannter Grund ist. Alles
 * Unbekannte gilt als "kein Problem" -- eine Meldung ohne Text waere
 * schlimmer als keine.
 */
export function istGoogleFotoProblem(
  value: unknown,
): value is GoogleFotoProblem {
  return typeof value === "string" && value in GOOGLE_FOTO_PROBLEM_TEXT;
}

/**
 * Wie schwer ein Grund wiegt. Gebraucht, wo mehrere Bilder auf einmal
 * entstehen (KI-Suche, req-057) und am Ende ein Satz dazu steht: dann soll
 * der Grund gewinnen, an dem der Betreiber etwas aendern muss -- eine
 * unbeschreibbare Ablage ist etwas anderes als ein Bild, das Google nicht
 * herausgibt.
 */
const RANG: Record<GoogleFotoProblem, number> = {
  nicht_geholt: 1,
  nicht_gespeichert: 2,
  ablage_fehlt: 3,
};

export function schwereresProblem(
  a: GoogleFotoProblem | null,
  b: GoogleFotoProblem | null,
): GoogleFotoProblem | null {
  if (!a) return b;
  if (!b) return a;
  return RANG[b] > RANG[a] ? b : a;
}
