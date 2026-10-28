"use client";

import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import type { TripState } from "@/lib/trips/state";
import type { TripParticipant } from "@/lib/trip-participants/types";
import type { Poi } from "@/lib/pois/types";
import type { TripTitelfoto } from "@/lib/trips/titelfoto";
import { EckdatenCard } from "./eckdaten-card";
import { TitelfotoCard } from "./titelfoto-card";
import { TripParticipantsCard } from "./trip-participants-card";
import styles from "@/components/cards.module.css";

/**
 * Der Bereich "Reisedetails" des Planers (req-033) -- bis dahin
 * "Einstellungen". Er zeigt alles zur geoeffneten Reise an einer Stelle:
 * ihre Eckdaten samt Beschreibung und Zustand (req-017, req-022, req-033)
 * und darunter, wer mitfaehrt (req-021).
 *
 * Was fuer den ganzen Account gilt, steht seit req-032 nicht hier: die
 * Personen des Accounts (req-019) und die Zugangsschluessel (req-028)
 * liegen im Bereich "Mein Bereich".
 *
 * Seit req-103 steht unter den Eckdaten das Titelfoto des gedruckten Plans
 * -- eine Angabe ueber die Reise wie Titel und Zeitraum.
 *
 * Mit trip = null entsteht eine neue Reise: die Eckdaten erscheinen leer,
 * und wer mitfaehrt, laesst sich erst festlegen, wenn es die Reise gibt --
 * bis zum Speichern gibt es nichts, dem jemand zugeordnet werden koennte
 * (req-033, Constraints).
 */
export function ReisedetailsView({
  trip,
  participants,
  tripParticipants = [],
  onTripParticipantsChange = () => {},
  onTripSaved,
  onCancelNewTrip,
  onDeleteTrip,
  onTripStateChanged,
  pois = [],
  titelfoto = null,
  hasAiKey = false,
  onTitelfotoChange = () => {},
}: {
  /** Die geoeffnete Reise, oder null beim Anlegen einer neuen. */
  trip: Trip | null;
  /** Die Personen des Accounts; zugeordnet wird je Reise. */
  participants: Participant[];
  /** Die Zuordnungen des Accounts ueber alle Reisen hinweg (req-021). */
  tripParticipants?: TripParticipant[];
  onTripParticipantsChange?: (tripParticipants: TripParticipant[]) => void;
  onTripSaved: (trip: Trip, tripParticipant: TripParticipant | null) => void;
  onCancelNewTrip: () => void;
  onDeleteTrip: (trip: Trip) => void;
  onTripStateChanged: (tripId: string, state: TripState) => void;
  /** Die POIs der Reise -- ihre Fotos stehen als Titelfoto zur Wahl (req-103). */
  pois?: Poi[];
  titelfoto?: TripTitelfoto | null;
  /** Ob ein Zugangsschluessel fuer die KI hinterlegt ist (req-028). */
  hasAiKey?: boolean;
  onTitelfotoChange?: (tripId: string, titelfoto: TripTitelfoto | null) => void;
}) {
  return (
    <section className={styles.area} aria-label="Reisedetails">
      <EckdatenCard
        // Ein Wechsel der geoeffneten Reise (und der Weg von der neuen zur
        // gespeicherten) setzt die Felder neu -- sonst stuenden die
        // Eingaben der vorherigen Reise darin.
        key={trip?.id ?? "neu"}
        trip={trip}
        onSaved={onTripSaved}
        onCancel={onCancelNewTrip}
        onDelete={onDeleteTrip}
        onStateChanged={onTripStateChanged}
      />
      {trip && (
        <TitelfotoCard
          key={`titelfoto-${trip.id}`}
          trip={trip}
          pois={pois}
          titelfoto={titelfoto}
          hasAiKey={hasAiKey}
          onChange={(neu) => onTitelfotoChange(trip.id, neu)}
        />
      )}
      {trip && (
        <TripParticipantsCard
          trip={trip}
          participants={participants}
          tripParticipants={tripParticipants}
          onChange={onTripParticipantsChange}
        />
      )}
    </section>
  );
}
