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
 * Was zu einer Zeile gespeichert ist (req-062) -- alles, was sich nicht aus
 * Plan und POI ergibt. Zu einem Programmpunkt entsteht so ein Datensatz erst,
 * wenn es etwas zu speichern gibt.
 */
export interface GespeicherteKostenzeile {
  id: string;
  tripId: string;
  /** Der Programmpunkt, zu dem die Zeile gehoert; null bei manuellen Zeilen. */
  activityId: string | null;
  /**
   * Bezeichnung, Preis und Buchungsstatus einer Zeile ohne POI. Bei einer
   * Zeile mit POI bleiben sie leer -- dort ist der POI die Wahrheit
   * (req-061).
   */
  bezeichnung: string | null;
  preisCent: number | null;
  buchung: PoiBuchung | null;
  /** Null heisst: die Anzahl zieht mit der Teilnehmerzahl nach. */
  anzahl: number | null;
  dokumentId: string | null;
  /**
   * Zeitpunkt des Anlegens (ISO-8601). Er gibt den manuellen Zeilen ihre
   * Reihenfolge -- die zuerst erfasste steht oben, und eine geaenderte
   * Bezeichnung schiebt sie nicht an eine andere Stelle.
   */
  createdAt: string;
}

/** Was sich an einer gespeicherten Zeile aendern laesst; was fehlt, bleibt. */
export interface KostenzeileAenderung {
  bezeichnung?: string;
  preisCent?: number | null;
  buchung?: PoiBuchung;
  anzahl?: number | null;
  dokumentId?: string | null;
}

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
  /** Das verknuepfte Dokument (req-034); null heisst "keines". */
  dokumentId: string | null;
}
