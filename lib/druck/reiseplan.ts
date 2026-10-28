import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import type { Trip } from "../trips/types";
import type { TripTitelfoto } from "../trips/titelfoto";
import type { GespeicherteKostenzeile } from "../kosten/types";
import type { Transfer } from "../transfers/types";
import { kostenzeilen } from "../kosten/zeilen";
import { kostenSummen } from "../kosten/summen";
import { druckDeckblatt } from "./deckblatt";
import { druckKosten } from "./kosten";
import { druckTage } from "./stationen";
import { druckUebersicht } from "./uebersicht";
import type { TagesUeberschrift } from "./ueberschriften";
import { tagesKarte } from "./karte";
import type { Reiseplan } from "./types";

/**
 * Das ganze Heft (req-080) -- aus Reise, Plan, POIs und Kostenplanung
 * gerechnet, ohne UI-Bezug. Die Transfers erscheinen seit req-103 nur auf den
 * Karten, als Linien -- im Tagesteil weiterhin nicht.
 *
 * Gezeichnet wird es in app/plan/reiseplan/; das PDF entsteht ueber die
 * Druckfunktion des Browsers (req-080, Constraints).
 */
export function reiseplan({
  trip,
  activities,
  pois,
  transfers = [],
  gespeicherteKostenzeilen = [],
  teilnehmerzahl,
  reiseleitung = [],
  optionSelections = {},
  stand,
  titelfoto = null,
  ueberschriften = [],
}: {
  trip: Trip;
  /** Die Programmpunkte dieser Reise, in beliebiger Reihenfolge. */
  activities: Activity[];
  /** Die POIs dieser Reise -- von ihnen kommen Fotos, Preis und Buchung. */
  pois: Poi[];
  /** Die Transfers dieser Reise -- die Linien der Karten (req-103). */
  transfers?: Transfer[];
  /** Was zur Kostenplanung gespeichert ist (req-062). */
  gespeicherteKostenzeilen?: GespeicherteKostenzeile[];
  teilnehmerzahl: number;
  /** Die Namen der Reiseleiter dieser Reise (req-021). */
  reiseleitung?: string[];
  /** Die gewaehlte Alternative je Options-Gruppe (req-004). */
  optionSelections?: Record<string, string>;
  /** Der Tag, an dem das Heft entsteht (ISO-Datum) -- der "Stand". */
  stand: string;
  /** Das gewaehlte Titelfoto der Reise (req-103); null heisst: die Vorgabe. */
  titelfoto?: TripTitelfoto | null;
  /** Die gespeicherten Ueberschriften der Reisetage (req-103). */
  ueberschriften?: TagesUeberschrift[];
}): Reiseplan {
  const ohneKarten = druckTage({ trip, activities, pois, optionSelections });
  // Jede Tagesseite traegt oben ihre eigene Karte (req-103) -- gemessen an
  // der ganzen Reise, was vor Ort liegt.
  const tage = ohneKarten.map((tag) => ({
    ...tag,
    karte: tagesKarte({ tag, tage: ohneKarten, activities, transfers }),
  }));
  const zeilen = kostenzeilen({
    trip,
    activities,
    pois,
    gespeicherte: gespeicherteKostenzeilen,
    teilnehmerzahl,
  });

  const summen = kostenSummen(zeilen, teilnehmerzahl);

  return {
    deckblatt: druckDeckblatt({
      trip,
      tage,
      activities,
      pois,
      teilnehmerzahl,
      summen,
      reiseleitung,
      stand,
      titelfoto,
    }),
    uebersicht: druckUebersicht({
      tage,
      activities,
      transfers,
      pois,
      ueberschriften,
      summen,
      teilnehmerzahl,
    }),
    tage,
    kosten: druckKosten(zeilen, teilnehmerzahl),
    fuss: `${trip.title} · ${trip.mainPlace.name}`,
  };
}
