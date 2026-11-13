/**
 * Der nachtraegliche Lauf fuer die Miniaturen (req-105). Er ist fuer die
 * Bilder, die schon vor den Miniaturen da waren -- jedes neue Bild bekommt
 * seine beim Ablegen.
 *
 * Diese Datei traegt nur die Formen, die Oberflaeche und Schnittstelle
 * gemeinsam brauchen; sie importiert nichts vom Server.
 */

/** Wie weit die Bildablage ist. */
export interface MiniaturenStand {
  /** Die Originale im Bildverzeichnis. */
  bilder: number;
  /** Davon die, neben denen ihre Miniatur liegt. */
  mitMiniatur: number;
}

/** Was ein Schritt des Laufs getan hat -- und wo der naechste anfaengt. */
export interface MiniaturenSchritt extends MiniaturenStand {
  /** Wie viele Originale bis hierher an der Reihe waren. */
  geprueft: number;
  /** In diesem Schritt neu verkleinert. */
  erzeugt: number;
  /** In diesem Schritt nicht zu verkleinern -- der Grund steht im Server-Log. */
  fehlgeschlagen: number;
  /**
   * Der Name, hinter dem der naechste Schritt weitermacht -- null, wenn der
   * Lauf durch ist.
   */
  weiter: string | null;
}

export const MINIATUREN_API = "/api/miniaturen";
