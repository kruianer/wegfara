"use client";

import { useMemo, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { TripState } from "@/lib/trips/state";
import type { Poi, PoiPosition, PoiStatus } from "@/lib/pois/types";
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
import { roleInTrip, withAssignment } from "@/lib/trip-participants/rules";
import type { Bewertungsrunde, Stimme } from "@/lib/bewertungen/types";
import { participantDisplayName } from "@/lib/participants/display-name";
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
  pois: initialPois = [],
  searchAreas: initialSearchAreas = [],
  activities: initialActivities = [],
  transfers: initialTransfers = [],
  optionSelections = {},
  participants: initialParticipants = [],
  tripParticipants: initialTripParticipants = [],
  documents: initialDocuments = [],
  superAdmin = false,
  apiKeys: initialApiKeys = [],
  runden: initialRunden = [],
  stimmen = [],
  selfParticipantId = "",
  initialArea = null,
  today,
}: {
  trips: Trip[];
  pois?: Poi[];
  /**
   * Die Suchgebiete der sichtbaren Reisen (req-012) -- hoechstens eines je
   * Reise. Wie bei den POIs (bug-020) nur der Anfangszustand vom Server:
   * gezeichnet, geaendert und entfernt wird ohne Neuladen (bug-030).
   */
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
  /**
   * Die Bewertungsrunden der sichtbaren Reisen (req-054) -- gestartet und
   * beendet werden sie hier, abgestimmt wird im Begleiter.
   */
  runden?: Bewertungsrunde[];
  /** Die abgegebenen Stimmen dieser Runden, mit Namen dahinter. */
  stimmen?: Stimme[];
  /**
   * Die angemeldete Person (req-054): ob sie eine Runde starten darf, haengt
   * an ihrer Rolle in der geoeffneten Reise.
   */
  selfParticipantId?: string;
  /**
   * Der Bereich, mit dem der Planer aufgeht (bug-033). Er kommt aus der
   * Adresse, damit ein Verweis aus "Mein Bereich" oder der "Verwaltung"
   * gezielt in einen Bereich fuehrt und nicht nur "irgendwo in den Planer".
   * Ohne Angabe bleibt es beim voreingestellten Bereich.
   */
  initialArea?: PlanAreaId | null;
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
  // Ein angelegter, geaenderter oder entfernter Transfer steht sofort im
  // Zeitstrahl, ohne Neuladen (req-052). Die Liste liegt aus demselben Grund
  // hier wie die der Programmpunkte: PlanungView unmountet beim Wechsel des
  // Planer-Bereichs.
  const [transfers, setTransfers] = useState(initialTransfers);
  // Ein angelegter, geaenderter oder entfernter POI bleibt sichtbar, ohne
  // Neuladen (bug-020). Die Liste liegt hier und nicht in PoisView, da diese
  // beim Wechsel des Planer-Bereichs unmountet -- gespeichert bleibt sonst
  // zwar gespeichert, waere beim Zurueckkommen aber wieder verschwunden.
  const [pois, setPois] = useState(initialPois);
  // Ein gezeichnetes, geaendertes oder entferntes Suchgebiet bleibt sichtbar,
  // ohne Neuladen (bug-030). Die Liste liegt aus demselben Grund hier wie die
  // der POIs: PoisView unmountet beim Wechsel des Planer-Bereichs, und beim
  // Wechsel der Reise nimmt sie das Suchgebiet der neuen Reise von hier --
  // gespeichert bliebe es sonst zwar gespeichert, waere aber bis zum
  // naechsten Neuladen wieder verschwunden.
  const [searchAreas, setSearchAreas] = useState(initialSearchAreas);
  // Die Rueckfrage vor dem Loeschen (req-017); sie wird seit req-033 aus den
  // Reisedetails heraus geoeffnet.
  const [deleting, setDeleting] = useState<Trip | null>(null);
  // Eine neue Reise wird in den Reisedetails angelegt (req-033): sie ist
  // solange nur diese Absicht -- erst das Speichern legt sie an, und wer
  // abbricht, hinterlaesst keinen Eintrag.
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [activeArea, setActiveArea] = useState<PlanAreaId>(
    initialArea ?? ACTIVE_PLAN_AREA,
  );
  const windowWidth = useWindowWidth();
  // Lebt hier statt in PoisView, da PoisView beim Wechsel des Planer-Bereichs
  // unmountet -- die Auswahl muss die Sitzung ueberdauern (siehe req-013).
  const [visibleMapStatuses, setVisibleMapStatuses] = useState<PoiStatus[]>(
    DEFAULT_MAP_VISIBLE_STATUSES,
  );
  // Eine gestartete oder beendete Bewertungsrunde steht sofort an ihren POIs,
  // ohne Neuladen (req-054). Die Stimmen selbst kommen aus dem Begleiter und
  // aendern sich im Planer nicht -- sie bleiben deshalb beim Anfangszustand.
  const [runden, setRunden] = useState(initialRunden);

  /** Eine gestartete oder beendete Runde ersetzt ihren vorherigen Stand. */
  function rememberRunde(gespeichert: Bewertungsrunde) {
    setRunden((current) =>
      current.some((runde) => runde.id === gespeichert.id)
        ? current.map((runde) =>
            runde.id === gespeichert.id ? gespeichert : runde,
          )
        : [gespeichert, ...current],
    );
  }

  /**
   * Das Suchgebiet einer Reise ersetzt ihr bisheriges; null nimmt es ihr
   * (bug-030). Je Reise gibt es hoechstens eines (req-012).
   */
  function rememberSearchArea(tripId: string, points: PoiPosition[] | null) {
    setSearchAreas((current) => {
      const uebrige = current.filter((area) => area.tripId !== tripId);
      return points ? [...uebrige, { tripId, points }] : uebrige;
    });
  }

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
    // Und ihre Dokumente verschwinden mitsamt den Dateien (req-034), ihre
    // gesammelten POIs ebenso.
    setDocuments((current) =>
      current.filter((document) => document.tripId !== deleted.id),
    );
    setPois((current) => current.filter((poi) => poi.tripId !== deleted.id));
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
    // Mit dem Programmpunkt geht der Weg von ihm oder zu ihm (req-052) --
    // geloescht ist er in der Ablage bereits (siehe lib/db/activities.ts).
    setTransfers((current) =>
      current.filter(
        (transfer) =>
          transfer.fromActivityId !== activity.id &&
          transfer.toActivityId !== activity.id,
      ),
    );
  }

  /**
   * Ein angelegter oder geaenderter Transfer (req-052) -- gespeichert ist er
   * da bereits. Ein geaenderter ersetzt den vorhandenen an seiner Stelle;
   * zwischen zwei Programmpunkten gibt es genau einen.
   */
  function handleTransferSaved(transfer: Transfer) {
    setTransfers((current) =>
      current.some((t) => t.id === transfer.id)
        ? current.map((t) => (t.id === transfer.id ? transfer : t))
        : [...current, transfer],
    );
  }

  /** Ein entfernter Transfer (req-052) -- er ist bereits geloescht. */
  function handleTransferRemoved(removed: Transfer) {
    setTransfers((current) => current.filter((t) => t.id !== removed.id));
  }

  /**
   * Ein uebernommener Planvorschlag (req-056): die angelegten und
   * verschobenen Programmpunkte stehen sofort im Zeitstrahl, die dabei
   * entstandenen Transfers zwischen ihnen. Gespeichert ist alles davon
   * bereits.
   */
  function handleVorschlagUebernommen(
    gespeicherte: Activity[],
    neueTransfers: Transfer[],
  ) {
    setActivities((current) => {
      const neu = new Map(
        gespeicherte.map((activity) => [activity.id, activity]),
      );
      const ersetzt = current.map((activity) => {
        const gespeichert = neu.get(activity.id);
        neu.delete(activity.id);
        return gespeichert ?? activity;
      });
      return [...ersetzt, ...neu.values()].sort((a, b) =>
        a.startAt.localeCompare(b.startAt),
      );
    });
    setTransfers((current) => [...current, ...neueTransfers]);
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

  /**
   * Angelegte, geaenderte, per KI gefundene (req-014) oder aus einem
   * Google-Maps-Link uebernommene POIs (req-026) -- gespeichert sind sie da
   * bereits (bug-020). Ein geaenderter oder aufgefrischter traegt die Kennung
   * eines vorhandenen und ersetzt ihn an seiner Stelle, statt ein zweites Mal
   * in der Liste zu erscheinen; ein neuer kommt nach oben (req-057) -- ein
   * Lauf der KI-Suche legt bis zu zwanzig auf einmal an, und unten in einer
   * langen Liste faende sie niemand.
   */
  function rememberPois(saved: Poi[]) {
    setPois((current) => {
      const neu = new Map(saved.map((poi) => [poi.id, poi]));
      const ersetzt = current.map((poi) => neu.get(poi.id) ?? poi);
      for (const poi of current) neu.delete(poi.id);
      return [...neu.values(), ...ersetzt];
    });
  }

  /** Ein entfernter POI (req-035) -- er ist bereits geloescht. */
  function forgetPoi(removed: Poi) {
    setPois((current) => current.filter((poi) => poi.id !== removed.id));
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

  /**
   * Die Teilnehmer einer Reise, unter dem Namen, unter dem sie angezeigt
   * werden (req-020) -- die Bewertungsrunde nennt auch, wer noch nicht
   * gestimmt hat (req-054).
   */
  function personenDerReise(tripId: string) {
    return participants
      .filter((person) =>
        tripParticipants.some(
          (assignment) =>
            assignment.tripId === tripId &&
            assignment.participantId === person.id,
        ),
      )
      .map((person) => ({
        id: person.id,
        name: participantDisplayName(person),
      }));
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
                hasAiKey={hasApiKey(apiKeys, "ki_suche")}
                onActivityPlanned={handleActivityPlanned}
                onActivityRemoved={handleActivityRemoved}
                onActivityRescheduled={handleActivityRescheduled}
                onTransferSaved={handleTransferSaved}
                onTransferRemoved={handleTransferRemoved}
                onVorschlagUebernommen={handleVorschlagUebernommen}
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
                onSearchAreaChanged={rememberSearchArea}
                visibleMapStatuses={visibleMapStatuses}
                onToggleMapStatus={toggleMapStatus}
                onPoisChanged={rememberPois}
                onPoiRemoved={forgetPoi}
                hasAiKey={hasApiKey(apiKeys, "ki_suche")}
                hasGoogleKey={hasApiKey(apiKeys, "google")}
                istReiseleiter={
                  roleInTrip(
                    tripParticipants,
                    selectedTrip.id,
                    selfParticipantId,
                  ) === "reiseleiter"
                }
                runden={runden.filter(
                  (runde) => runde.tripId === selectedTrip.id,
                )}
                stimmen={stimmen}
                personen={personenDerReise(selectedTrip.id)}
                onRundeGestartet={rememberRunde}
                onRundeBeendet={rememberRunde}
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
