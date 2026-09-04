"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { TripState } from "@/lib/trips/state";
import type { Poi, PoiStatus } from "@/lib/pois/types";
import { DEFAULT_MAP_VISIBLE_STATUSES } from "@/lib/pois/status-meta";
import type { SearchArea } from "@/lib/pois/search-area";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { Participant } from "@/lib/participants/types";
import {
  apiKeyStates,
  hasApiKey,
  type ApiKeyState,
} from "@/lib/api-keys/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { withAssignment } from "@/lib/trip-participants/rules";
import { defaultTripId } from "@/lib/trips/select-default";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";
import {
  ACTIVE_PLAN_AREA,
  SWITCHABLE_PLAN_AREAS,
  type PlanAreaId,
} from "@/lib/plan/areas";
import { useWindowWidth } from "./use-window-width";
import { Header } from "./components/header";
import { PoisView } from "./components/pois-view";
import { PlanungView } from "./components/planung-view";
import { ReisedetailsView } from "./components/reisedetails-view";
import { AccountView } from "./components/account-view";
import { NarrowNotice } from "./components/narrow-notice";
import { NoTrips } from "./components/no-trips";
import { TripDeleteDialog } from "./components/trip-delete-dialog";
import styles from "./plan-view.module.css";

function byStartDate(a: Trip, b: Trip): number {
  return a.startDate.localeCompare(b.startDate);
}

export function PlanView({
  trips: initialTrips,
  pois = [],
  searchAreas = [],
  activities = [],
  transfers = [],
  optionSelections = {},
  participants: initialParticipants = [],
  tripParticipants: initialTripParticipants = [],
  selfParticipantId = "",
  superAdmin = false,
  accountAdmin = false,
  apiKeys: initialApiKeys = [],
  today,
}: {
  trips: Trip[];
  pois?: Poi[];
  searchAreas?: SearchArea[];
  activities?: Activity[];
  transfers?: Transfer[];
  optionSelections?: Record<string, string>;
  /**
   * Die Personen des Accounts, nicht einer einzelnen Reise (siehe req-019).
   * Sie stehen im Bereich "Account" und werden nie nach der geoeffneten
   * Reise gefiltert (req-032).
   */
  participants?: Participant[];
  /**
   * Wer bei welcher Reise mitfaehrt (req-021) -- ueber alle Reisen des
   * Accounts, damit ein Wechsel der geoeffneten Reise ihre eigene Zuordnung
   * zeigt, ohne nachzuladen.
   */
  tripParticipants?: TripParticipant[];
  /** Die angemeldete Person -- sie ist in der Liste gekennzeichnet (req-019). */
  selfParticipantId?: string;
  /**
   * Ob die angemeldete Person der Gesamt-Admin ist (req-025) -- nur bei ihr
   * zeigt der Kopfbereich die Account-Verwaltung.
   */
  superAdmin?: boolean;
  /**
   * Ob die angemeldete Person die Personen des Accounts verwalten darf
   * (req-027) -- nur dann zeigt die Karte "Reiseteilnehmer" im Bereich
   * "Account" die Schaltflaechen zum Anlegen, Aendern und Entfernen.
   */
  accountAdmin?: boolean;
  /**
   * Der Zustand der Zugangsschluessel des Accounts (req-028) -- gesetzt oder
   * nicht. Er entscheidet, ob die KI-Suche und der Import aus Google
   * ueberhaupt bedienbar sind; der Schluessel selbst kommt nie hierher.
   */
  apiKeys?: ApiKeyState[];
  today: string;
}) {
  const todayDate = useMemo(() => {
    const { year, month, day } = parseIsoDate(today);
    return new Date(year, month - 1, day);
  }, [today]);

  // Reisen lassen sich anlegen, aendern und loeschen, ohne die Seite neu zu
  // laden (siehe req-017) -- der serverseitig geladene Anfangszustand ist
  // deshalb nur der Startwert.
  const [trips, setTrips] = useState(initialTrips);
  const [selectedTripId, setSelectedTripId] = useState(() =>
    defaultTripId(initialTrips, todayDate),
  );
  // Die Personen des Accounts liegen hier statt in AccountView: sie werden im
  // Bereich "Account" verwaltet (req-032) und im Bereich "Einstellungen" der
  // Reise zugeordnet (req-021) -- beide Bereiche sehen dieselbe Liste, und
  // eine angelegte oder entfernte Person bleibt es ueber den Wechsel des
  // Planer-Bereichs hinaus.
  const [participants, setParticipants] = useState(initialParticipants);
  // Die Zuordnungen liegen hier statt in EinstellungenView: sie ueberdauern
  // so einen Wechsel des Planer-Bereichs, und eine neu angelegte Reise
  // bringt die Zuordnung ihres Anlegenden gleich mit (req-021).
  const [tripParticipants, setTripParticipants] = useState(
    initialTripParticipants,
  );
  // Setzt oder entfernt ein Account-Admin einen Zugangsschluessel, sperrt
  // oder entsperrt das die zugehoerige Funktion sofort -- ohne Neuladen und
  // ueber den Wechsel des Planer-Bereichs hinweg (req-028).
  const [apiKeys, setApiKeys] = useState(() => apiKeyStates(initialApiKeys));
  // Die Rueckfrage vor dem Loeschen (req-017); sie wird seit req-033 aus den
  // Reisedetails heraus geoeffnet.
  const [deleting, setDeleting] = useState<Trip | null>(null);
  // Eine neue Reise wird in den Reisedetails angelegt (req-033): sie ist
  // solange nur diese Absicht -- erst das Speichern legt sie an, und wer
  // abbricht, hinterlaesst keinen Eintrag.
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [activeArea, setActiveArea] = useState<PlanAreaId>(ACTIVE_PLAN_AREA);
  const windowWidth = useWindowWidth();
  // Lebt hier statt in PoisView, da PoisView beim Wechsel des Planer-Bereichs
  // unmountet -- die Auswahl muss die Sitzung ueberdauern (siehe req-013).
  const [visibleMapStatuses, setVisibleMapStatuses] = useState<PoiStatus[]>(
    DEFAULT_MAP_VISIBLE_STATUSES,
  );

  function toggleMapStatus(status: PoiStatus) {
    setVisibleMapStatuses((current) =>
      current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status],
    );
  }

  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null;

  function selectArea(area: PlanAreaId) {
    if (!SWITCHABLE_PLAN_AREAS.includes(area)) return;
    // Wer den Bereich wechselt, bricht das Anlegen ab -- ohne Speichern
    // entsteht keine Reise (req-033, Constraints).
    setCreatingTrip(false);
    setActiveArea(area);
  }

  /** "Neue Reise" fuehrt direkt in die Reisedetails (req-033). */
  function startNewTrip() {
    setCreatingTrip(true);
    setActiveArea("reisedetails");
  }

  /** Zeigt die Reisedetails einer Reise -- und oeffnet sie dafuer (req-033). */
  function openTripDetails(trip: Trip) {
    setCreatingTrip(false);
    setSelectedTripId(trip.id);
    setActiveArea("reisedetails");
  }

  function selectTrip(tripId: string) {
    setCreatingTrip(false);
    setSelectedTripId(tripId);
  }

  /** Nach dem Anlegen wird die neue Reise geoeffnet (siehe req-017). */
  function handleTripSaved(saved: Trip, assigned: TripParticipant | null) {
    setTrips((current) =>
      (current.some((t) => t.id === saved.id)
        ? current.map((t) => (t.id === saved.id ? saved : t))
        : [...current, saved]
      ).sort(byStartDate),
    );
    // Wer eine Reise anlegt, ist ihr als Reiseleiter zugeordnet (req-021);
    // die Zuordnung entsteht beim Anlegen und kommt von dort mit.
    if (assigned) {
      setTripParticipants((current) =>
        withAssignment(
          current,
          assigned.tripId,
          assigned.participantId,
          assigned.role,
        ),
      );
    }
    setSelectedTripId(saved.id);
    setCreatingTrip(false);
  }

  /**
   * War die geloeschte Reise gerade geoeffnet, wird danach eine andere
   * geoeffnet -- nach derselben Regel wie beim ersten Aufruf (req-017).
   */
  function handleTripDeleted(deleted: Trip) {
    const remaining = trips.filter((t) => t.id !== deleted.id);
    setTrips(remaining);
    // Mit der Reise enden ihre Zuordnungen (req-021).
    setTripParticipants((current) =>
      current.filter((assignment) => assignment.tripId !== deleted.id),
    );
    if (deleted.id === selectedTripId) {
      setSelectedTripId(defaultTripId(remaining, todayDate));
    }
    setDeleting(null);
  }

  /**
   * Der Zustand ist bereits gespeichert, wenn das hier ankommt (req-022) --
   * die Liste zieht nur nach, damit die Reise ohne Neuladen richtig steht.
   */
  function handleTripStateChanged(tripId: string, state: TripState) {
    setTrips((current) =>
      current.map((trip) => (trip.id === tripId ? { ...trip, state } : trip)),
    );
  }

  function tripContents(trip: Trip) {
    return {
      pois: pois.filter((poi) => poi.tripId === trip.id).length,
      activities: activities.filter((a) => a.tripId === trip.id).length,
      transfers: transfers.filter((t) => t.tripId === trip.id).length,
    };
  }

  /**
   * Die Reisedetails einer noch nicht angelegten Reise (req-033): leere
   * Felder, keine Karte "Wer faehrt mit" -- es gibt noch nichts, dem jemand
   * zugeordnet werden koennte.
   */
  const neueReiseDetails = (
    <ReisedetailsView
      trip={null}
      participants={participants}
      tripParticipants={tripParticipants}
      onTripParticipantsChange={setTripParticipants}
      onTripSaved={handleTripSaved}
      onCancelNewTrip={() => setCreatingTrip(false)}
      onDeleteTrip={setDeleting}
      onTripStateChanged={handleTripStateChanged}
    />
  );

  return (
    <div className={styles.app}>
      {windowWidth < PLANNER_MIN_WIDTH_PX ? (
        <NarrowNotice />
      ) : !selectedTrip ? (
        /* Ohne geoeffnete Reise gibt es keinen Kopfbereich. Wer die erste
           anlegt, sieht deshalb nur ihre Reisedetails (req-033). */
        creatingTrip ? (
          <main className={styles.content}>{neueReiseDetails}</main>
        ) : (
          <NoTrips onCreateTrip={startNewTrip} />
        )
      ) : (
        <>
          <Header
            trips={trips}
            selectedTrip={selectedTrip}
            today={todayDate}
            activeArea={activeArea}
            superAdmin={superAdmin}
            onSelectTrip={selectTrip}
            onSelectArea={selectArea}
            onCreateTrip={startNewTrip}
            onOpenTripDetails={openTripDetails}
          />
          <main className={styles.content}>
            {creatingTrip ? (
              neueReiseDetails
            ) : activeArea === "reisedetails" ? (
              <ReisedetailsView
                trip={selectedTrip}
                participants={participants}
                tripParticipants={tripParticipants}
                onTripParticipantsChange={setTripParticipants}
                onTripSaved={handleTripSaved}
                onCancelNewTrip={() => setCreatingTrip(false)}
                onDeleteTrip={setDeleting}
                onTripStateChanged={handleTripStateChanged}
              />
            ) : activeArea === "account" ? (
              /* Der Bereich "Account" haengt an keiner Reise (req-032) --
                 die geoeffnete Reise kommt hier bewusst nicht an. */
              <AccountView
                participants={participants}
                onParticipantsChange={setParticipants}
                selfParticipantId={selfParticipantId}
                accountAdmin={accountAdmin}
                tripParticipants={tripParticipants}
                onTripParticipantsChange={setTripParticipants}
                apiKeys={apiKeys}
                onApiKeysChange={setApiKeys}
              />
            ) : activeArea === "planung" ? (
              <PlanungView
                trip={selectedTrip}
                pois={pois.filter((poi) => poi.tripId === selectedTrip.id)}
                activities={activities.filter(
                  (activity) => activity.tripId === selectedTrip.id,
                )}
                transfers={transfers.filter(
                  (transfer) => transfer.tripId === selectedTrip.id,
                )}
                optionSelections={optionSelections}
                today={todayDate}
              />
            ) : (
              <PoisView
                pois={pois.filter((poi) => poi.tripId === selectedTrip.id)}
                mainPlace={selectedTrip.mainPlace}
                windowWidth={windowWidth}
                tripId={selectedTrip.id}
                searchArea={
                  searchAreas.find((area) => area.tripId === selectedTrip.id)
                    ?.points ?? null
                }
                visibleMapStatuses={visibleMapStatuses}
                onToggleMapStatus={toggleMapStatus}
                hasAiKey={hasApiKey(apiKeys, "ki_suche")}
                hasGoogleKey={hasApiKey(apiKeys, "google")}
              />
            )}
          </main>
        </>
      )}
      {deleting && (
        <TripDeleteDialog
          trip={deleting}
          contents={tripContents(deleting)}
          onDeleted={handleTripDeleted}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
