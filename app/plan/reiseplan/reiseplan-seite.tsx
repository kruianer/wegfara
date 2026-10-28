"use client";

import { useMemo, useState } from "react";
import type { Activity, DruckDarstellung } from "@/lib/activities/types";
import type { Poi } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import type { GespeicherteKostenzeile } from "@/lib/kosten/types";
import type { Transfer } from "@/lib/transfers/types";
import type { TripTitelfoto } from "@/lib/trips/titelfoto";
import type { TagesUeberschrift } from "@/lib/druck/ueberschriften";
import { saveDruckDarstellung } from "@/lib/activities/save-druck-darstellung";
import { reiseplan } from "@/lib/druck/reiseplan";
import { ReiseplanDruck } from "./reiseplan-druck";
import { ReiseplanSteuerung } from "./reiseplan-steuerung";
import { UeberschriftenSteuerung } from "./ueberschriften-steuerung";

/**
 * Die Seite "Reiseplan zum Ausdrucken" (req-080): das Heft und daneben, nur
 * am Bildschirm, die Kennzeichen je Programmpunkt.
 *
 * Das Heft wird hier gerechnet und nicht auf dem Server: wer ein Kennzeichen
 * aendert, soll die Wirkung sofort sehen, ohne die Seite neu zu laden.
 * Gespeichert wird dabei trotzdem -- und zwar zuerst nicht: erst wird
 * geschrieben, und was nicht ankam, nimmt die Anzeige zurueck (bug-021).
 */
export function ReiseplanSeite({
  trip,
  activities: initialActivities,
  pois,
  transfers = [],
  gespeicherteKostenzeilen = [],
  teilnehmerzahl,
  reiseleitung = [],
  optionSelections = {},
  stand,
  titelfoto = null,
  ueberschriften: initialUeberschriften = [],
  hasAiKey = false,
}: {
  trip: Trip;
  activities: Activity[];
  pois: Poi[];
  /** Die Transfers der Reise -- die Linien der Karten (req-103). */
  transfers?: Transfer[];
  gespeicherteKostenzeilen?: GespeicherteKostenzeile[];
  teilnehmerzahl: number;
  reiseleitung?: string[];
  optionSelections?: Record<string, string>;
  stand: string;
  /** Das gewaehlte Titelfoto der Reise (req-103). */
  titelfoto?: TripTitelfoto | null;
  /** Die gespeicherten Ueberschriften der Reisetage (req-103). */
  ueberschriften?: TagesUeberschrift[];
  /** Ob ein Zugangsschluessel fuer die KI hinterlegt ist (req-028). */
  hasAiKey?: boolean;
}) {
  const [activities, setActivities] = useState(initialActivities);
  // Erzeugte und von Hand gesetzte Ueberschriften stehen sofort im Heft.
  const [ueberschriften, setUeberschriften] = useState(initialUeberschriften);
  const [fehler, setFehler] = useState(false);

  const plan = useMemo(
    () =>
      reiseplan({
        trip,
        activities,
        pois,
        transfers,
        gespeicherteKostenzeilen,
        teilnehmerzahl,
        reiseleitung,
        optionSelections,
        stand,
        titelfoto,
        ueberschriften,
      }),
    [
      trip,
      activities,
      pois,
      transfers,
      gespeicherteKostenzeilen,
      teilnehmerzahl,
      reiseleitung,
      optionSelections,
      stand,
      titelfoto,
      ueberschriften,
    ],
  );

  /**
   * Ein Kennzeichen setzen. Die Anzeige folgt gleich, damit das Heft daneben
   * sofort anders aussieht; schlug das Speichern fehl, geht sie zurueck und
   * sagt es -- ein nur scheinbar gesetztes Kennzeichen darf es nicht geben
   * (bug-021).
   */
  async function setze(activity: Activity, darstellung: DruckDarstellung) {
    const vorher = activity.druckDarstellung;
    setFehler(false);
    setActivities((liste) =>
      liste.map((a) =>
        a.id === activity.id ? { ...a, druckDarstellung: darstellung } : a,
      ),
    );

    if (await saveDruckDarstellung(activity.id, darstellung)) return;

    setActivities((liste) =>
      liste.map((a) =>
        a.id === activity.id ? { ...a, druckDarstellung: vorher } : a,
      ),
    );
    setFehler(true);
  }

  return (
    <ReiseplanDruck
      reiseplan={plan}
      steuerung={
        <>
          <ReiseplanSteuerung
            trip={trip}
            activities={activities}
            onSetze={(activity, darstellung) =>
              void setze(activity, darstellung)
            }
            fehler={fehler}
          />
          <UeberschriftenSteuerung
            tripId={trip.id}
            zeilen={plan.uebersicht.zeilen}
            ueberschriften={ueberschriften}
            hasAiKey={hasAiKey}
            onChange={setUeberschriften}
          />
        </>
      }
    />
  );
}
