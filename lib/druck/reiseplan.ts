import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import type { Trip } from "../trips/types";
import type { GespeicherteKostenzeile } from "../kosten/types";
import { kostenzeilen } from "../kosten/zeilen";
import { kostenSummen } from "../kosten/summen";
import { druckDeckblatt } from "./deckblatt";
import { druckKosten } from "./kosten";
import { druckTage } from "./stationen";
import type { Reiseplan } from "./types";

/**
 * Das ganze Heft (req-080) -- aus Reise, Plan, POIs und Kostenplanung
 * gerechnet, ohne UI-Bezug und ohne Transfers: die kommen hier gar nicht
 * herein.
 *
 * Gezeichnet wird es in app/plan/reiseplan/; das PDF entsteht ueber die
 * Druckfunktion des Browsers (req-080, Constraints).
 */
export function reiseplan({
  trip,
  activities,
  pois,
  gespeicherteKostenzeilen = [],
  teilnehmerzahl,
  reiseleitung = [],
  optionSelections = {},
  stand,
}: {
  trip: Trip;
  /** Die Programmpunkte dieser Reise, in beliebiger Reihenfolge. */
  activities: Activity[];
  /** Die POIs dieser Reise -- von ihnen kommen Fotos, Preis und Buchung. */
  pois: Poi[];
  /** Was zur Kostenplanung gespeichert ist (req-062). */
  gespeicherteKostenzeilen?: GespeicherteKostenzeile[];
  teilnehmerzahl: number;
  /** Die Namen der Reiseleiter dieser Reise (req-021). */
  reiseleitung?: string[];
  /** Die gewaehlte Alternative je Options-Gruppe (req-004). */
  optionSelections?: Record<string, string>;
  /** Der Tag, an dem das Heft entsteht (ISO-Datum) -- der "Stand". */
  stand: string;
}): Reiseplan {
  const tage = druckTage({ trip, activities, pois, optionSelections });
  const zeilen = kostenzeilen({
    trip,
    activities,
    pois,
    gespeicherte: gespeicherteKostenzeilen,
    teilnehmerzahl,
  });

  return {
    deckblatt: druckDeckblatt({
      trip,
      tage,
      activities,
      pois,
      teilnehmerzahl,
      summen: kostenSummen(zeilen, teilnehmerzahl),
      reiseleitung,
      stand,
    }),
    tage,
    kosten: druckKosten(zeilen, teilnehmerzahl),
    fuss: `${trip.title} · ${trip.mainPlace.name}`,
  };
}
