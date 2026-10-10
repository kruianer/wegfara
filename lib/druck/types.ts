import type { PoiBuchung } from "../pois/types";

/**
 * Der gedruckte Reiseplan (req-080) -- das Heft, das der Reiseleiter vor der
 * Reise verschickt und aushaendigt. Es ist nicht der Begleiter unterwegs: hier
 * stehen keine Dauer, keine Endzeit, kein Buchungszustand und keine Preise im
 * Tagesteil, und keine Transfers.
 *
 * Diese Datei beschreibt, was auf den Seiten steht -- gerechnet wird es in
 * lib/druck/, gezeichnet in app/plan/reiseplan/. Die verbindliche Vorlage fuer
 * das Aussehen ist das Mockup
 * (delivery/design/reiseplan-druck/variante-c-magazin.mockup.html).
 */

/**
 * Die fuenf Layouts einer Station (req-080). Welches eine Station bekommt,
 * entscheidet `stationLayouts` (lib/druck/layouts.ts) -- nach einer Regel,
 * nicht nach Zufall.
 */
export type StationLayout = "l1" | "l2" | "l3" | "l4" | "l5";

/** Ein Foto, wie es im Heft erscheint -- die Datei kommt ueber `poiFotoUrl`. */
export interface DruckFoto {
  id: string;
  /** Ob es ein KI-Bild ist (req-072) -- es traegt sein Zeichen auch im Druck. */
  istKiBild: boolean;
}

/** Eine Station: ein Programmpunkt, wie er im Heft steht. */
export interface DruckStation {
  activityId: string;
  layout: StationLayout;
  /** Nur die Startzeit, z.B. "09:00" -- keine Dauer, keine Endzeit. */
  startzeit: string;
  /** Die Art des Programmpunkts, bei einer Nebenstation "Nebenstation". */
  art: string;
  name: string;
  /** Der Langtext (req-044); leer, wenn keiner hinterlegt ist. */
  langtext: string;
  /** Das grosse Foto; null, wenn der POI keines hat oder keiner dahinter steht. */
  grossesFoto: DruckFoto | null;
  /** Die kleinen Fotos -- je Layout zwei oder drei, sofern vorhanden. */
  kleineFotos: DruckFoto[];
  /**
   * Der Satz zur Alternative einer Options-Gruppe (req-004); null, wenn die
   * Station allein zu ihrer Zeit liegt.
   */
  alternative: string | null;
}

/** Eine Seite des Tagesteils: ein Reisetag mit seinen Stationen. */
export interface DruckTag {
  /** Die Tagesnummer innerhalb der Reise, beginnend bei 1. */
  nummer: number;
  /** ISO-Datum (YYYY-MM-DD). */
  datum: string;
  /** Ausgeschrieben, z.B. "Sonntag, 25. Oktober 2026". */
  datumText: string;
  /** Leer bei einem Tag ohne Programmpunkte -- die Seite bleibt trotzdem. */
  stationen: DruckStation[];
}

/** Eine der vier Zahlen des Dashboards auf Seite 1. */
export interface DruckZahl {
  wert: string;
  /** Die kleine Einheit hinter der Zahl, z.B. "Tage" oder "€". */
  einheit: string | null;
  bezeichnung: string;
  /** Ob die Zahl in Safran steht -- im Mockup die geplanten Kosten. */
  warm?: boolean;
}

/** Eine Zeile der Eckdaten auf Seite 1. */
export interface DruckEckdatum {
  label: string;
  wert: string;
  warm?: boolean;
}

/** Seite 1: Bild und Dashboard. */
export interface DruckDeckblatt {
  titel: string;
  /** Ort und Zeitraum, z.B. "Amalfi · 18. – 23. Juli 2026". */
  ort: string;
  /** Der handschriftliche Satz ueber dem Titel; leer, wenn es keinen gibt. */
  vorspann: string;
  beschreibung: string;
  zahlen: DruckZahl[];
  eckdaten: DruckEckdatum[];
  /** Das Foto ueber den oberen zwei Dritteln; null, wenn es keines gibt. */
  titelFoto: DruckFoto | null;
}

/** Eine Position der letzten Seite. */
export interface DruckPosten {
  id: string;
  name: string;
  /** Woher die Position kommt, z.B. "Tag 2 · Mi 22.07. · 8,00 € je Person · 4 ×". */
  zusatz: string;
  buchung: PoiBuchung;
  /** Der Betrag, z.B. "32,00 €"; null heisst "offen" -- und nicht "0 €". */
  betrag: string | null;
}

/** Die letzte Seite: Kosten und Buchungen. */
export interface DruckKosten {
  posten: DruckPosten[];
  gesamt: string;
  /** Der Betrag je Person; null, wenn der Reise noch niemand zugeordnet ist. */
  jePerson: string | null;
}

/** Das ganze Heft. */
export interface Reiseplan {
  deckblatt: DruckDeckblatt;
  tage: DruckTag[];
  kosten: DruckKosten;
  /** Die Zeile am Fuss jeder Seite, z.B. "Süditalien Rundreise · Amalfi". */
  fuss: string;
}
