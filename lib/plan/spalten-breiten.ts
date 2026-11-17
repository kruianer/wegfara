import {
  KARTE_MIN_BREITE_PX,
  POI_AUSWAHL_BREITE_PX,
  TRENNER_BREITE_PX,
  ZEITSTRAHL_MIN_BREITE_PX,
} from "@/lib/design/stil";

/**
 * Wie die drei Spalten der Planung eingeteilt sind (req-109): die Breite der
 * POI-Auswahl und die des Zeitstrahls, so wie sie zuletzt gezogen wurden. Die
 * Karte nimmt, was beide uebrig lassen -- sie hat keine eigene Breite.
 *
 * `null` heisst: an diesem Trenner wurde nie gezogen, die Spalte steht auf
 * ihrer Untergrenze -- 340 und 412 px, wie vor req-109.
 */
export interface SpaltenEinteilung {
  auswahl: number | null;
  zeitstrahl: number | null;
}

/** Nie gezogen: die Spalten stehen wie vor req-109. */
export const UNGEZOGENE_EINTEILUNG: SpaltenEinteilung = {
  auswahl: null,
  zeitstrahl: null,
};

/** Wie breit POI-Auswahl und Zeitstrahl gerade tatsaechlich stehen. */
export interface SpaltenBreiten {
  auswahl: number;
  zeitstrahl: number;
}

/**
 * Wie die drei Spalten auf dem Platz stehen, den die Planung hat.
 *
 * `platz` ist die Breite der ganzen Reihe, Trenner eingeschlossen; 0 heisst,
 * sie ist (noch) nicht gemessen -- dann gilt die Einteilung, wie sie ist.
 *
 * Ist das Fenster seit dem Ziehen schmaler geworden, passt die Einteilung
 * nicht mehr: zuerst gibt der Zeitstrahl her, dann die POI-Auswahl, jeweils
 * bis auf ihre Untergrenze -- so ragt keine Spalte ueber den Rand (stack.md,
 * Bildschirmbreiten, Regel 1). Gemerkt bleibt die Einteilung trotzdem; wird
 * das Fenster wieder breiter, steht sie wieder da.
 *
 * Zugeklappt ist die POI-Auswahl der Streifen aus req-099, und ihr Trenner
 * ist fort. Ihre gezogene Breite bleibt in der Einteilung stehen und gilt
 * wieder, sobald sie aufgeklappt wird.
 */
export function spaltenBreiten(
  einteilung: SpaltenEinteilung,
  { platz, zugeklappt }: { platz: number; zugeklappt: boolean },
): SpaltenBreiten {
  let auswahl = zugeklappt
    ? POI_AUSWAHL_BREITE_PX.zu
    : Math.max(
        POI_AUSWAHL_BREITE_PX.offen,
        einteilung.auswahl ?? POI_AUSWAHL_BREITE_PX.offen,
      );
  let zeitstrahl = Math.max(
    ZEITSTRAHL_MIN_BREITE_PX,
    einteilung.zeitstrahl ?? ZEITSTRAHL_MIN_BREITE_PX,
  );
  if (platz <= 0) return { auswahl, zeitstrahl };

  let ueber =
    auswahl +
    zeitstrahl +
    trennerBreite(zugeklappt) +
    KARTE_MIN_BREITE_PX -
    platz;
  if (ueber > 0) {
    const vomZeitstrahl = Math.min(
      ueber,
      zeitstrahl - ZEITSTRAHL_MIN_BREITE_PX,
    );
    zeitstrahl -= vomZeitstrahl;
    ueber -= vomZeitstrahl;
  }
  if (ueber > 0 && !zugeklappt) {
    auswahl -= Math.min(ueber, auswahl - POI_AUSWAHL_BREITE_PX.offen);
  }
  return { auswahl, zeitstrahl };
}

/** Wie viel Breite die Trenner selbst nehmen: zugeklappt steht nur einer. */
function trennerBreite(zugeklappt: boolean): number {
  return (zugeklappt ? 1 : 2) * TRENNER_BREITE_PX;
}

/**
 * Der linke Trenner, um `versatz` px verschoben (req-109): er verschiebt die
 * Grenze zwischen POI-Auswahl und Zeitstrahl -- was die eine gewinnt, verliert
 * der andere.
 *
 * Steht der Zeitstrahl dabei auf seiner Untergrenze, schiebt der Trenner ihn
 * vor sich her, und die Karte gibt her, bis auf ihre Mindestbreite: breiter
 * als ihre Untergrenze darf jede Spalte werden, solange die anderen ihre
 * behalten. Ohne das bewegte sich der Trenner bei der Einteilung von vor
 * req-109 gar nicht -- dort steht der Zeitstrahl schon auf 412 px.
 *
 * `start` sind die Breiten beim Anfassen; gerechnet wird immer von dort, nicht
 * Schritt fuer Schritt, sonst liefe der Trenner dem Finger davon. Zurueck
 * bekommt der Zeitstrahl deshalb auch, was er beim Hinweg hergab.
 */
export function zieheLinkenTrenner(
  start: SpaltenBreiten,
  versatz: number,
  { platz }: { platz: number },
): SpaltenBreiten {
  const hoechstens =
    platz > 0
      ? platz -
        ZEITSTRAHL_MIN_BREITE_PX -
        trennerBreite(false) -
        KARTE_MIN_BREITE_PX
      : start.auswahl + start.zeitstrahl - ZEITSTRAHL_MIN_BREITE_PX;
  const auswahl = Math.min(
    Math.max(POI_AUSWAHL_BREITE_PX.offen, start.auswahl + versatz),
    // Stand die Auswahl schon breiter, wird sie dadurch nicht schmaler -- ein
    // Trenner springt nie von selbst.
    Math.max(start.auswahl, hoechstens),
  );
  const zeitstrahl = Math.max(
    ZEITSTRAHL_MIN_BREITE_PX,
    start.zeitstrahl - (auswahl - start.auswahl),
  );
  return { auswahl, zeitstrahl };
}

/**
 * Der rechte Trenner, um `versatz` px verschoben (req-109): er verschiebt die
 * Grenze zwischen Zeitstrahl und Karte. Die Karte behaelt dabei ihre
 * Mindestbreite (KARTE_MIN_BREITE_PX); die POI-Auswahl bleibt, wie sie ist.
 */
export function zieheRechtenTrenner(
  start: SpaltenBreiten,
  versatz: number,
  { platz, zugeklappt }: { platz: number; zugeklappt: boolean },
): SpaltenBreiten {
  const hoechstens =
    platz > 0
      ? platz - start.auswahl - trennerBreite(zugeklappt) - KARTE_MIN_BREITE_PX
      : Number.POSITIVE_INFINITY;
  const zeitstrahl = Math.min(
    Math.max(ZEITSTRAHL_MIN_BREITE_PX, start.zeitstrahl + versatz),
    // Stand der Zeitstrahl schon breiter, als es die Karte erlaubt, wird er
    // dadurch nicht schmaler -- ein Trenner springt nie von selbst.
    Math.max(start.zeitstrahl, hoechstens),
  );
  return { auswahl: start.auswahl, zeitstrahl };
}
