"use client";

import type { Activity } from "@/lib/activities/types";
import type { Poi } from "@/lib/pois/types";
import type { Transfer } from "@/lib/transfers/types";
import type { Trip } from "@/lib/trips/types";
import type { TripTitelfoto } from "@/lib/trips/titelfoto";
import type { GespeicherteKostenzeile } from "@/lib/kosten/types";
import type { TagesUeberschrift } from "@/lib/druck/ueberschriften";
import { reiseplanDruckPath } from "@/lib/druck/pfad";
import { ReiseplanSeite } from "../reiseplan/reiseplan-seite";
import styles from "./drucken-view.module.css";

/**
 * Der Bereich "Drucken" des Planers (req-103) -- der gedruckte Reiseplan als
 * Teil des Planers statt in einem eigenen Browser-Reiter (req-080).
 *
 * Darin stehen die Vorschau und ein Knopf zum Drucken. Die Vorschau ist
 * dasselbe Geruest wie die eigene Adresse des Plans (ReiseplanSeite) -- eine
 * zweite Fassung entsteht nicht. Gedruckt wird ueber den Browser
 * (`@media print`); dabei bleiben Seitenleiste und dieser Kopf weg.
 *
 * Die eigene Adresse bleibt: wer den Plan verschicken oder fuer sich oeffnen
 * will, findet sie hier.
 */
export function DruckenView({
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
  hasAiKey,
  onActivityChanged,
  onUeberschriftenChange,
}: {
  trip: Trip;
  activities: Activity[];
  pois: Poi[];
  transfers: Transfer[];
  gespeicherteKostenzeilen: GespeicherteKostenzeile[];
  teilnehmerzahl: number;
  reiseleitung: string[];
  optionSelections: Record<string, string>;
  stand: string;
  titelfoto: TripTitelfoto | null;
  ueberschriften: TagesUeberschrift[];
  hasAiKey: boolean;
  /** Ein geaendertes Kennzeichen eines Programmpunkts (req-080). */
  onActivityChanged: (activity: Activity) => void;
  onUeberschriftenChange: (ueberschriften: TagesUeberschrift[]) => void;
}) {
  return (
    <section className={styles.bereich} aria-label="Drucken">
      <div className={styles.kopf}>
        <h1 className={styles.titel}>Reiseplan zum Ausdrucken</h1>
        <a className={styles.adresse} href={reiseplanDruckPath(trip.id)}>
          Als eigene Seite öffnen
        </a>
        <button
          type="button"
          className={styles.druckKnopf}
          onClick={() => window.print()}
        >
          Plan drucken
        </button>
      </div>
      <div className={styles.vorschau}>
        <ReiseplanSeite
          // Ein Wechsel der Reise beginnt mit deren Stand.
          key={trip.id}
          trip={trip}
          activities={activities}
          pois={pois}
          transfers={transfers}
          gespeicherteKostenzeilen={gespeicherteKostenzeilen}
          teilnehmerzahl={teilnehmerzahl}
          reiseleitung={reiseleitung}
          optionSelections={optionSelections}
          stand={stand}
          titelfoto={titelfoto}
          ueberschriften={ueberschriften}
          hasAiKey={hasAiKey}
          onActivityChanged={onActivityChanged}
          onUeberschriftenChange={onUeberschriftenChange}
        />
      </div>
    </section>
  );
}
