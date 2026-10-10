import { redirect } from "next/navigation";
import { getPool } from "@/lib/db/pool";
import { findTrip, listTripsForSession } from "@/lib/db/trips";
import { listPois } from "@/lib/db/pois";
import { listActivities } from "@/lib/db/activities";
import { listActivityOptionSelections } from "@/lib/db/activity-option-selections";
import { listParticipants } from "@/lib/db/participants";
import { listTripParticipants } from "@/lib/db/trip-participants";
import { listKostenzeilen } from "@/lib/db/kostenzeilen";
import { requireTripAccess } from "@/lib/auth/current-session";
import { BEGLEITER_PATH, darfPlanen } from "@/lib/einstieg/ziel";
import { participantDisplayName } from "@/lib/participants/display-name";
import { tripAssignments } from "@/lib/trip-participants/rules";
import { selectionsForVisibleTrips, visibleTripIds } from "@/lib/trips/visible";
import { ReiseplanSeite } from "../reiseplan-seite";

/**
 * Der Reiseplan zum Ausdrucken (req-080) -- eine eigene Seite im Planer, aus
 * der ueber die Druckfunktion des Browsers das PDF entsteht. Sie ist keine
 * Ansicht des Planers, sondern ein Blatt: deshalb eine eigene Adresse und
 * nicht ein siebter Bereich.
 *
 * Was auf den Seiten steht, rechnet lib/druck/reiseplan.ts -- hier wird nur
 * geladen, gegen den Mandanten geprueft und uebergeben.
 */

// Haengt vom aktuellen Datum und Live-Daten aus der DB ab -- nie statisch
// vorrendern.
export const dynamic = "force-dynamic";

export default async function ReiseplanDruckPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const today = new Date().toISOString().slice(0, 10);

  // Dieselbe Pruefung wie vor dem Planer (req-016, req-023, req-055): eine
  // angemeldete Person, und der Mandant kommt aus ihrer Anmeldung -- nie aus
  // der Adresse (req-024).
  const session = await requireTripAccess();
  const accountId = session.accountId;
  const pool = getPool();

  const [
    trips,
    trip,
    activities,
    pois,
    optionSelections,
    participants,
    tripParticipants,
    kostenzeilen,
  ] = await Promise.all([
    listTripsForSession(pool, session),
    findTrip(pool, accountId, tripId),
    listActivities(pool, accountId),
    listPois(pool, accountId),
    listActivityOptionSelections(pool, accountId),
    listParticipants(pool, accountId),
    listTripParticipants(pool, accountId),
    listKostenzeilen(pool, accountId),
  ]);

  // Wer den Planer nicht darf, landet ohne Meldung im Begleiter -- dieselbe
  // Regel, mit denselben Eingaben (bug-035).
  if (
    !darfPlanen({
      tripParticipants,
      participantId: session.participant.id,
      accountAdmin: session.accountAdmin,
    })
  ) {
    redirect(BEGLEITER_PATH);
  }

  // Eine Reise, die diese Person nicht sieht, gibt es fuer sie nicht -- auch
  // nicht als leeres Heft.
  const sichtbar = visibleTripIds(trips);
  if (!trip || !sichtbar.has(trip.id)) {
    redirect(BEGLEITER_PATH);
  }

  const zuordnungen = tripAssignments(tripParticipants, trip.id);
  const namen = new Map(
    participants.map((person) => [person.id, participantDisplayName(person)]),
  );

  return (
    <ReiseplanSeite
      trip={trip}
      activities={activities.filter((a) => a.tripId === trip.id)}
      pois={pois.filter((poi) => poi.tripId === trip.id)}
      gespeicherteKostenzeilen={kostenzeilen.filter(
        (zeile) => zeile.tripId === trip.id,
      )}
      teilnehmerzahl={zuordnungen.length}
      reiseleitung={zuordnungen
        .filter((zuordnung) => zuordnung.role === "reiseleiter")
        .map((zuordnung) => namen.get(zuordnung.participantId) ?? "")
        .filter((name) => name.length > 0)}
      optionSelections={selectionsForVisibleTrips(
        optionSelections,
        new Set([trip.id]),
      )}
      stand={today}
    />
  );
}
