"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Trip } from "@/lib/trips/types";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import { formatDateRange } from "@/lib/trips/format";
import { TRIP_STATUS_LABEL, tripStatus } from "@/lib/trips/status";
import { TRIP_STATE_LABEL } from "@/lib/trips/state";
import { PLAN_AREAS, type PlanArea, type PlanAreaId } from "@/lib/plan/areas";
import { AbmeldenButton } from "@/components/abmelden-button";
import { PencilIcon, PlusIcon } from "@/components/icons";
import styles from "./header.module.css";

function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5 L14.6 9.4 L21.5 12 L14.6 14.6 L12 21.5 L9.4 14.6 L2.5 12 L9.4 9.4 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M12 5.5 L13.6 10.4 L18.5 12 L13.6 13.6 L12 18.5 L10.4 13.6 L5.5 12 L10.4 10.4 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Header({
  trips,
  selectedTrip,
  today,
  areas = PLAN_AREAS,
  activeArea,
  onSelectTrip,
  onSelectArea,
  onCreateTrip,
  onOpenTripDetails,
  superAdmin = false,
}: {
  trips: Trip[];
  selectedTrip: Trip;
  today: Date;
  /** Die Bereiche der geoeffneten Reise (req-009). */
  areas?: PlanArea[];
  activeArea: PlanAreaId;
  /**
   * Ob die angemeldete Person der Gesamt-Admin ist (req-025). Nur bei ihr
   * erscheint der Bereich "Verwaltung" (bis req-036 "Account-Verwaltung");
   * fuer alle anderen gibt es ihn im Kopfbereich nicht.
   */
  superAdmin?: boolean;
  onSelectTrip: (tripId: string) => void;
  onSelectArea: (area: PlanAreaId) => void;
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
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <CompassIcon />
        </span>
        <div>
          <div className={styles.wordmark}>Wegfara</div>
          <div className={styles.tagline}>KI · Reiseplanung</div>
        </div>
      </div>
      <nav className={styles.nav} aria-label="Planer-Bereiche">
        {areas.map((area) => {
          const active = area.id === activeArea;
          return (
            <button
              key={area.id}
              type="button"
              className={`${styles.navButton} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelectArea(area.id)}
            >
              {area.label}
            </button>
          );
        })}
        {/* "Mein Bereich" steht neben den Bereichen der Reise, ist aber
            keiner von ihnen (req-043): er gehoert der angemeldeten Person
            und ihrem Account, liegt auf einer eigenen Seite und ist von dort
            auch aus dem Begleiter erreichbar. Jede angemeldete Person sieht
            ihn -- was sie darin zu sehen bekommt, entscheidet die Seite
            selbst. */}
        <Link className={styles.navButton} href={MEIN_BEREICH_PATH}>
          Mein Bereich
        </Link>
        {/* Die "Verwaltung" ist ein eigener Bereich mit eigener Adresse
            (req-025) -- sie liegt nicht im Planer-Zustand, sondern auf einer
            eigenen Seite. Sie erscheint nur beim Gesamt-Admin; wer sie ohne
            die Kennzeichnung direkt aufruft, bekommt keinen Zugriff (siehe
            lib/auth/super-admin.ts). Die Adresse traegt weiterhin
            "accounts" -- umbenannt wurde mit req-036 nur die Beschriftung. */}
        {superAdmin && (
          <Link className={styles.navButton} href={ACCOUNTS_PATH}>
            Verwaltung
          </Link>
        )}
      </nav>
      <div className={styles.tripSwitcher} ref={switcherRef}>
        <button
          type="button"
          className={styles.tripButton}
          aria-haspopup="dialog"
          aria-expanded={tripListOpen}
          onClick={() => setTripListOpen((open) => !open)}
        >
          <span className={styles.tripName}>{selectedTrip.title}</span>
          <span className={styles.tripDates}>
            {formatDateRange(selectedTrip)}
          </span>
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
                      onClick={() =>
                        withClosedList(() => onSelectTrip(trip.id))
                      }
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
      {/* Der Weg zu "Mein Bereich" steht im Kopfbereich schon neben den
          uebrigen Bereichen (req-043) -- hier bleibt nur das Abmelden. Im
          Begleiter, wo es keine solche Leiste gibt, fuehrt weiterhin das
          Personen-Zeichen dorthin (siehe components/mein-bereich-leiste). */}
      <AbmeldenButton />
    </header>
  );
}
