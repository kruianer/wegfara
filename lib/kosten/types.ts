import type { PoiBuchung } from "../pois/types";

/**
 * Die Kostenplanung einer Reise (req-062): was die Reise kosten wird --
 * insgesamt und je Person. Sie ist die Kalkulation **vorher**; was unterwegs
 * tatsaechlich gezahlt wurde, sind die Ausgaben (req-029) und bleibt davon
 * getrennt.
 */

/**
 * Woher eine Zeile stammt. Eine Zeile aus dem Zeitstrahl entsteht mit ihrem
 * Programmpunkt und verschwindet mit ihm; eine manuelle Zeile traegt, was
 * kein Programmpunkt ist -- Maut, Parkgebuehren, Sprit.
 */
export type KostenzeileHerkunft = "programmpunkt" | "manuell";

/**
 * Eine Zeile der Tabelle, wie sie angezeigt wird. Sie wird bei jeder Anzeige
 * neu gebildet (siehe zeilen.ts) -- gespeichert ist nur, was sich nicht aus
 * Plan und POI ergibt.
 */
export interface Kostenzeile {
  /**
   * Die Kennung der Zeile: bei einer Zeile aus dem Zeitstrahl die des
   * Programmpunkts, bei einer manuellen die der gespeicherten Zeile.
   */
  id: string;
  herkunft: KostenzeileHerkunft;
  /** Der Programmpunkt, aus dem die Zeile stammt; bei manuellen Zeilen null. */
  activityId: string | null;
  /** Der POI dahinter -- Preis und Buchungsstatus stehen an ihm (req-061). */
  poiId: string | null;
  /** Name des POI, bei einem Programmpunkt ohne POI sein Titel. */
  bezeichnung: string;
  /** Der Reisetag des Programmpunkts, z.B. "Tag 2 · Mi 22.07."; sonst null. */
  reisetag: string | null;
  /** Preis je Person in Cent; null heisst "nicht eingetragen". */
  preisCent: number | null;
  /** Vorbelegt mit der Teilnehmerzahl, von Hand aenderbar. */
  anzahl: number;
  /** Preis mal Anzahl; ohne Preis gibt es keine Gesamtsumme. */
  gesamtCent: number | null;
  buchung: PoiBuchung;
}
