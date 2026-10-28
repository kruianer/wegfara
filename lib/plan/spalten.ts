/**
 * Ab dieser Fensterbreite stehen die Spalten des Planers nebeneinander, wie
 * sie req-009 gebaut hat: in der Planung POI-Auswahl, Zeitstrahl und
 * Tageskarte, in den Bereichen POIs und Chat beide Seiten am verschiebbaren
 * Trenner (req-088).
 *
 * Darunter -- ab der Mindestbreite des Planers (lib/plan/viewport.ts), also
 * auf dem iPad hochkant -- passen die festen Breiten nicht mehr nebeneinander:
 * Seitenleiste, POI-Auswahl und Zeitstrahl sind zusammen schon 812 px. Dort
 * zeigt die Planung den Zeitstrahl und daneben eine der beiden anderen
 * Spalten, POIs und Chat zeigen eine ihrer beiden Seiten; ein Umschalter
 * waehlt, welche.
 */
export const SPALTEN_NEBENEINANDER_AB_PX = 1180;

/**
 * Ab dieser Fensterbreite stehen im Bereich POIs Liste und Karte
 * nebeneinander (req-097) -- frueher als die uebrigen Spalten: die Liste ist
 * seither nur noch 324 px breit, und auf dem iPad quer bleiben der Karte
 * daneben 632 px. Darunter gilt die schmale Ordnung aus req-088.
 */
export const LISTE_UND_KARTE_NEBENEINANDER_AB_PX = 1024;

/** Ob bei dieser Fensterbreite alle Spalten nebeneinander Platz haben. */
export function stehenSpaltenNebeneinander(fensterbreite: number): boolean {
  return fensterbreite >= SPALTEN_NEBENEINANDER_AB_PX;
}

/**
 * Welche Spalte in der Planung neben dem Zeitstrahl steht, solange nicht alle
 * drei Platz haben (req-088). Der Zeitstrahl selbst bleibt immer stehen --
 * er ist das Ziel jeder Handlung.
 *
 * Ein Zustand der Ansicht, nicht der Daten: gespeichert wird er nicht.
 */
export type PlanungSeite = "auswahl" | "karte";

/** Ohne Wahl steht die POI-Auswahl daneben -- aus ihr wird geplant. */
export const VORGEWAEHLTE_PLANUNG_SEITE: PlanungSeite = "auswahl";
