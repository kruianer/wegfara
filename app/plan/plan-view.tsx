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
import type { TripDocument } from "@/lib/documents/types";
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
import { DokumenteView } from "./components/dokumente-view";
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
  activities: initialActivities = [],
  transfers = [],
  optionSelections = {},
  participants: initialParticipants = [],
  tripParticipants: initialTripParticipants = [],
  documents: initialDocuments = [],
  superAdmin = false,
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
   * Der Planer braucht sie in den Reisedetails, um sie einer Reise
   * zuzuordnen (req-021); verwaltet werden sie seit req-043 in "Mein
   * Bereich".
   */
  participants?: Participant[];
  /**
   * Wer bei welcher Reise mitfaehrt (req-021) -- ueber alle Reisen des
   * Accounts, damit ein Wechsel der geoeffneten Reise ihre eigene Zuordnung
   * zeigt, ohne nachzuladen.
   */
  tripParticipants?: TripParticipant[];
  /**
   * Die abgelegten Dokumente aller sichtbaren Reisen (req-034) -- der
   * Bereich "Dokumente" zeigt die der geoeffneten Reise.
   */
  documents?: TripDocument[];
  /**
   * Ob die angemeldete Person der Gesamt-Admin ist (req-025) -- nur bei ihr
   * zeigt der Kopfbereich die "Verwaltung" (req-036).
   */
  superAdmin?: boolean;
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
  // Die Personen des Accounts. Angelegt, geaendert und entfernt werden sie
  // seit req-043 in "Mein Bereich" -- einer eigenen Seite; der Planer
  // ordnet sie in den Reisedetails nur einer Reise zu (req-021) und aendert
  // die Liste selbst nicht mehr.
  const participants = initialParticipants;
  // Die Zuordnungen liegen hier statt in EinstellungenView: sie ueberdauern
  // so einen Wechsel des Planer-Bereichs, und eine neu angelegte Reise
  // bringt die Zuordnung ihres Anlegenden gleich mit (req-021).
  const [tripParticipants, setTripParticipants] = useState(
    initialTripParticipants,
  );
  // Ob die Zugangsschluessel des Accounts hinterlegt sind (req-028) -- sie
  // sperren oder entsperren die KI-Suche und den Import aus Google.
  // Hinterlegt werden sie seit req-043 in "Mein Bereich"; im Planer aendert
  // sich daran nichts.
  const apiKeys = useMemo(() => apiKeyStates(initialApiKeys), [initialApiKeys]);
  // Ein abgelegtes, geaendertes oder entferntes Dokument steht sofort in
  // der Liste, ohne Neuladen (req-034).
  const [documents, setDocuments] = useState(initialDocuments);
  // Ein verplanter POI und ein entfernter Programmpunkt sind sofort sichtbar
  // (req-039). Die Liste liegt hier und nicht in PlanungView, da diese beim
  // Wechsel des Planer-Bereichs unmountet -- verplant bleibt verplant, auch
  // ohne Neuladen.
  const [activities, setActivities] = useState(initialActivities);
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
    // Und ihre Dokumente verschwinden mitsamt den Dateien (req-034).
    setDocuments((current) =>
      current.filter((document) => document.tripId !== deleted.id),
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

  /**
   * Ein aus einem POI entstandener Programmpunkt (req-039). Er steht sofort
   * im Zeitstrahl, und sein POI verschwindet damit aus "Noch unverplant" --
   * beides ergibt sich aus derselben Liste.
   */
  function handleActivityPlanned(activity: Activity) {
    setActivities((current) =>
      [...current, activity].sort((a, b) => a.startAt.localeCompare(b.startAt)),
    );
  }

  /**
   * Ein entfernter Programmpunkt (req-039). Stammte er aus einem POI, steht
   * dieser danach wieder unter "Noch unverplant".
   */
  function handleActivityRemoved(activity: Activity) {
    setActivities((current) => current.filter((a) => a.id !== activity.id));
  }

  /**
   * Ein umgeplanter Programmpunkt (req-040): verschoben, auf einen anderen
   * Reisetag gezogen oder in seiner Dauer geaendert. Er steht sofort an
   * seiner neuen Stelle -- gespeichert ist er da bereits.
   */
  function handleActivityRescheduled(activity: Activity) {
    setActivities((current) =>
      current
        .map((a) => (a.id === activity.id ? activity : a))
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    );
  }

  /** Ein abgelegtes oder geaendertes Dokument, das neueste zuerst (req-034). */
  function rememberDocument(saved: TripDocument) {
    setDocuments((current) => {
      const ohne = current.filter((document) => document.id !== saved.id);
      return [saved, ...ohne].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    });
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
            ) : activeArea === "dokumente" ? (
              <DokumenteView
                trip={selectedTrip}
                documents={documents.filter(
                  (document) => document.tripId === selectedTrip.id,
                )}
                pois={pois.filter((poi) => poi.tripId === selectedTrip.id)}
                transfers={transfers.filter(
                  (transfer) => transfer.tripId === selectedTrip.id,
                )}
                participants={participants}
                onDocumentSaved={rememberDocument}
                onDocumentRemoved={(removed) =>
                  setDocuments((current) =>
                    current.filter((document) => document.id !== removed.id),
                  )
                }
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
                onActivityPlanned={handleActivityPlanned}
                onActivityRemoved={handleActivityRemoved}
                onActivityRescheduled={handleActivityRescheduled}
              />
            ) : (
              <PoisView
                pois={pois.filter((poi) => poi.tripId === selectedTrip.id)}
                activities={activities.filter(
                  (activity) => activity.tripId === selectedTrip.id,
                )}
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
