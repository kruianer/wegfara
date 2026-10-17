"use client";

import { useMemo, useState } from "react";
import type { Activity, DruckDarstellung } from "@/lib/activities/types";
import type { Poi } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import type { GespeicherteKostenzeile } from "@/lib/kosten/types";
import { saveDruckDarstellung } from "@/lib/activities/save-druck-darstellung";
import { reiseplan } from "@/lib/druck/reiseplan";
import { ReiseplanDruck } from "./reiseplan-druck";
import { ReiseplanSteuerung } from "./reiseplan-steuerung";

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
  gespeicherteKostenzeilen = [],
  teilnehmerzahl,
  reiseleitung = [],
  optionSelections = {},
  stand,
}: {
  trip: Trip;
  activities: Activity[];
  pois: Poi[];
  gespeicherteKostenzeilen?: GespeicherteKostenzeile[];
  teilnehmerzahl: number;
  reiseleitung?: string[];
  optionSelections?: Record<string, string>;
  stand: string;
}) {
  const [activities, setActivities] = useState(initialActivities);
  const [fehler, setFehler] = useState(false);

  const plan = useMemo(
    () =>
      reiseplan({
        trip,
        activities,
        pois,
        gespeicherteKostenzeilen,
        teilnehmerzahl,
        reiseleitung,
        optionSelections,
        stand,
      }),
    [
      trip,
      activities,
      pois,
      gespeicherteKostenzeilen,
      teilnehmerzahl,
      reiseleitung,
      optionSelections,
      stand,
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
        <ReiseplanSteuerung
          trip={trip}
          activities={activities}
          onSetze={(activity, darstellung) => void setze(activity, darstellung)}
          fehler={fehler}
        />
      }
    />
  );
}
