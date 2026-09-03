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
import { EinstellungenView } from "./components/einstellungen-view";
import { NarrowNotice } from "./components/narrow-notice";
import { NoTrips } from "./components/no-trips";
import { TripForm } from "./components/trip-form";
import { TripDeleteDialog } from "./components/trip-delete-dialog";
import styles from "./plan-view.module.css";

/** Welche ueberlagernde Flaeche der Reiseverwaltung offen ist (req-017). */
type TripDialog =
  | { kind: "none" }
  | { kind: "form"; trip: Trip | null }
  | { kind: "delete"; trip: Trip };

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
  participants = [],
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
  /** Die Personen des Accounts, nicht einer einzelnen Reise (siehe req-019). */
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
   * (req-027) -- nur dann zeigt die Karte "Reiseteilnehmer" die
   * Schaltflaechen zum Anlegen, Aendern und Entfernen.
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
  const [dialog, setDialog] = useState<TripDialog>({ kind: "none" });
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
    if (SWITCHABLE_PLAN_AREAS.includes(area)) setActiveArea(area);
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
    setDialog({ kind: "none" });
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
    setDialog({ kind: "none" });
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

  return (
    <div className={styles.app}>
      {windowWidth < PLANNER_MIN_WIDTH_PX ? (
        <NarrowNotice />
      ) : !selectedTrip ? (
        <NoTrips onCreateTrip={() => setDialog({ kind: "form", trip: null })} />
      ) : (
        <>
          <Header
            trips={trips}
            selectedTrip={selectedTrip}
            today={todayDate}
            activeArea={activeArea}
            superAdmin={superAdmin}
            onSelectTrip={setSelectedTripId}
            onSelectArea={selectArea}
            onCreateTrip={() => setDialog({ kind: "form", trip: null })}
            onEditTrip={(trip) => setDialog({ kind: "form", trip })}
            onDeleteTrip={(trip) => setDialog({ kind: "delete", trip })}
            onTripStateChanged={handleTripStateChanged}
          />
          <main className={styles.content}>
            {activeArea === "einstellungen" ? (
              <EinstellungenView
                trip={selectedTrip}
                participants={participants}
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
      {dialog.kind === "form" && (
        <TripForm
          key={dialog.trip?.id ?? "neu"}
          trip={dialog.trip}
          onSaved={handleTripSaved}
          onClose={() => setDialog({ kind: "none" })}
        />
      )}
      {dialog.kind === "delete" && (
        <TripDeleteDialog
          trip={dialog.trip}
          contents={tripContents(dialog.trip)}
          onDeleted={handleTripDeleted}
          onCancel={() => setDialog({ kind: "none" })}
        />
      )}
    </div>
  );
}
