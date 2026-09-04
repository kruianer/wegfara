"use client";

import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { TripParticipantsCard } from "./trip-participants-card";
import styles from "./plan-cards.module.css";

/**
 * Der Bereich "Einstellungen" des Planers. Er zeigt die Karte "Wer faehrt
 * mit" mit der Zuordnung der Personen des Accounts zur geoeffneten Reise
 * (req-021).
 *
 * Was fuer den ganzen Account gilt, steht seit req-032 nicht mehr hier: die
 * Personen des Accounts (req-019) und die Zugangsschluessel (req-028) sind
 * in den Bereich "Account" gewandert, damit ein Reisewechsel nicht so
 * aussieht, als aenderten sie sich mit.
 */
export function EinstellungenView({
  trip,
  participants,
  tripParticipants = [],
  onTripParticipantsChange = () => {},
}: {
  /** Die geoeffnete Reise -- fuer die Zuordnung (req-021). */
  trip: Trip;
  /** Die Personen des Accounts; zugeordnet wird je Reise. */
  participants: Participant[];
  /** Die Zuordnungen des Accounts ueber alle Reisen hinweg (req-021). */
  tripParticipants?: TripParticipant[];
  onTripParticipantsChange?: (tripParticipants: TripParticipant[]) => void;
}) {
  return (
    <section className={styles.area} aria-label="Einstellungen">
      <TripParticipantsCard
        trip={trip}
        participants={participants}
        tripParticipants={tripParticipants}
        onChange={onTripParticipantsChange}
      />
    </section>
  );
}
