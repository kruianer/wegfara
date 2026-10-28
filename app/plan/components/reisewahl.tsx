"use client";

import { useEffect, useRef, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import { formatDateRange } from "@/lib/trips/format";
import { TRIP_STATUS_LABEL, tripStatus } from "@/lib/trips/status";
import { TRIP_STATE_LABEL } from "@/lib/trips/state";
import { PencilIcon, PlusIcon, ReiseIcon } from "@/components/icons";
import styles from "./reisewahl.module.css";

/** Der kurze Name der Reisewahl in der Seitenleiste (req-094). */
export const REISEWAHL_KURZ = "Reisen";

/**
 * Die Wahl der geoeffneten Reise (req-017). Sie stand bis req-077 in der
 * Kopfleiste des Planers (`header.tsx`) und sitzt seither im Kopf der
 * Seitenleiste: die Kopfleiste ist mit req-077 entfallen, damit Zeitstrahl
 * und Karte ihre Hoehe zurueckbekommen.
 *
 * Seit req-094 ist die Leiste immer schmal, und fuer Name und Zeitraum der
 * Reise ist darin kein Platz. Die Reisewahl traegt deshalb wie die Bereiche
 * ihr Symbol mit einem kurzen Namen darunter -- "Reisen", denn sie oeffnet
 * die Liste aller Reisen. "Reise" heisst in der Leiste schon der Bereich
 * Reisedetails; zwei gleich beschriftete Eintraege uebereinander waeren
 * nicht zu unterscheiden.
 *
 * Welche Reise offen ist, nennt der Tooltip mit ihrem vollen Namen, und
 * genauso das `aria-label` fuer Vorleseprogramme.
 */
export function Reisewahl({
  trips,
  selectedTrip,
  today,
  symbolGroesse,
  onSelectTrip,
  onCreateTrip,
  onOpenTripDetails,
}: {
  trips: Trip[];
  selectedTrip: Trip;
  today: Date;
  /** Die Groesse der Symbole in der Leiste -- sie gibt die Seitenleiste vor. */
  symbolGroesse: number;
  onSelectTrip: (tripId: string) => void;
  /**
   * Der Weg zum Anlegen liegt im Aufklappmenue am Reisenamen (req-017) und
   * fuehrt seit req-033 in die Reisedetails -- ein Formular oeffnet sich
   * hier nicht mehr.
   */
  onCreateTrip: () => void;
  /**
   * Oeffnet die Reisedetails dieser Reise (req-033). Dort stehen ihre
   * Eckdaten, ihr Zustand und wer mitfaehrt -- und dort wird sie geloescht.
   */
  onOpenTripDetails: (trip: Trip) => void;
}) {
  const [tripListOpen, setTripListOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  function withClosedList(action: () => void) {
    setTripListOpen(false);
    action();
  }

  /**
   * Das Aufklappmenue legt sich als Dialog ueber die Ansicht -- es muss
   * deshalb auch daneben wieder wegzubekommen sein (bug-018): ein Tippen
   * ausserhalb schliesst es, ebenso die Escape-Taste. Ohne das blieb es
   * stehen, sobald ein Tippen auf einen seiner Eintraege nicht ankam (am
   * iPad nicht selten, siehe bug-017) -- und verdeckte genau die
   * Reisedetails, in die "Neue Reise" fuehrt (req-033).
   *
   * Das Tippen wird nicht abgefangen: es erreicht die Ansicht darunter, und
   * was dort liegt, ist mit einem Griff bedienbar.
   */
  useEffect(() => {
    if (!tripListOpen) return;

    function closeOnOutside(event: PointerEvent) {
      if (!switcherRef.current?.contains(event.target as Node)) {
        setTripListOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setTripListOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [tripListOpen]);

  return (
    <div className={styles.tripSwitcher} ref={switcherRef}>
      <button
        type="button"
        className={styles.tripButton}
        aria-label={`Reise: ${selectedTrip.title}`}
        title={`Reise: ${selectedTrip.title}`}
        aria-haspopup="dialog"
        aria-expanded={tripListOpen}
        onClick={() => setTripListOpen((open) => !open)}
      >
        <span className={styles.tripIcon}>
          <ReiseIcon size={symbolGroesse} />
        </span>
        <span className={styles.tripLabel}>{REISEWAHL_KURZ}</span>
      </button>
      {tripListOpen && (
        <div
          className={styles.dropdown}
          role="dialog"
          aria-label="Reise wählen"
        >
          <ul className={styles.list}>
            {trips.map((trip) => {
              const status = tripStatus(trip, today);
              return (
                <li key={trip.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={trip.id === selectedTrip.id}
                    onClick={() => withClosedList(() => onSelectTrip(trip.id))}
                  >
                    <span className={styles.itemInfo}>
                      <span className={styles.itemName}>{trip.title}</span>
                      <span className={styles.itemDates}>
                        {formatDateRange(trip)}
                      </span>
                    </span>
                  </button>
                  {/* Zwei Kennzeichnungen nebeneinander (req-022): links
                      der aus dem Zeitraum berechnete Zeitstatus, rechts
                      der gesetzte Zustand. Beide sind hier nur zu sehen --
                      gesetzt wird der Zustand seit req-033 in den
                      Reisedetails. */}
                  <span
                    className={`${styles.statusPill} ${styles[status]}`}
                    title="Zeitstatus"
                  >
                    {TRIP_STATUS_LABEL[status]}
                  </span>
                  <span
                    className={styles.statePill}
                    title="Zustand"
                    aria-label={`Zustand: ${trip.title}`}
                  >
                    {TRIP_STATE_LABEL[trip.state]}
                  </span>
                  {/* Fuehrt in die Reisedetails dieser Reise -- dort
                      stehen ihre Eckdaten, und dort wird sie auch
                      geloescht (req-033). */}
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Reisedetails: ${trip.title}`}
                    onClick={() =>
                      withClosedList(() => onOpenTripDetails(trip))
                    }
                  >
                    <PencilIcon />
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className={styles.newTrip}
            onClick={() => withClosedList(onCreateTrip)}
          >
            <PlusIcon />
            Neue Reise
          </button>
        </div>
      )}
    </div>
  );
}
