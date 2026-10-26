/**
 * Mindestbreite des Planers in Pixeln. req-009 legte 1180 px fest, solange
 * der Planer aus drei festen Spalten nebeneinander bestand; seit req-088 laeuft
 * er ab 768 px (iPad hochkant) -- darunter steht der Hinweis auf den Begleiter.
 * Ab welcher Breite die drei Spalten nebeneinander stehen, steht in
 * lib/plan/spalten.ts.
 */
export const PLANNER_MIN_WIDTH_PX = 768;
