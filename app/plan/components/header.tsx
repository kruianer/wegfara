"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/types";
import { formatDateRange } from "@/lib/trips/format";
import { TRIP_STATUS_LABEL, tripStatus } from "@/lib/trips/status";
import { PLAN_AREAS, type PlanAreaId } from "@/lib/plan/areas";
import { KontoLeiste } from "@/components/konto-leiste";
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

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4l10-10-4-4L4 16v4Z M14.5 5.5l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7h14 M9 7V5h6v2 M7 7l1 12h8l1-12 M10 10v6 M14 10v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5v14 M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Header({
  trips,
  selectedTrip,
  today,
  activeArea,
  onSelectTrip,
  onSelectArea,
  onCreateTrip,
  onEditTrip,
  onDeleteTrip,
}: {
  trips: Trip[];
  selectedTrip: Trip;
  today: Date;
  activeArea: PlanAreaId;
  onSelectTrip: (tripId: string) => void;
  onSelectArea: (area: PlanAreaId) => void;
  /** Anlegen, Aendern und Loeschen liegen an derselben Stelle: im
   *  Aufklappmenue am Reisenamen (siehe req-017). */
  onCreateTrip: () => void;
  onEditTrip: (trip: Trip) => void;
  onDeleteTrip: (trip: Trip) => void;
}) {
  const [tripListOpen, setTripListOpen] = useState(false);

  function withClosedList(action: () => void) {
    setTripListOpen(false);
    action();
  }

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
        {PLAN_AREAS.map((area) => {
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
      </nav>
      <div className={styles.tripSwitcher}>
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
                      <span
                        className={`${styles.statusPill} ${styles[status]}`}
                      >
                        {TRIP_STATUS_LABEL[status]}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Reise ändern: ${trip.title}`}
                      onClick={() => withClosedList(() => onEditTrip(trip))}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.danger}`}
                      aria-label={`Reise löschen: ${trip.title}`}
                      onClick={() => withClosedList(() => onDeleteTrip(trip))}
                    >
                      <TrashIcon />
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
      <KontoLeiste />
    </header>
  );
}
