"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { WeatherReading } from "@/lib/weather/types";
import type { ActivityGroup } from "@/lib/activities/groups";
import type { TripParticipant } from "@/lib/trip-participants/types";
import type { Expense, ExpensePerson } from "@/lib/expenses/types";
import type { TripDocument } from "@/lib/documents/types";
import type { Poi } from "@/lib/pois/types";
import type { Bewertungsrunde as Runde, Stimme } from "@/lib/bewertungen/types";
import {
  laufendeRunde,
  ohneMichJeProgrammpunkt,
} from "@/lib/bewertungen/stand";
import { laufendeReise, offeneAbstimmung } from "@/lib/einstieg/ziel";
import { participantDisplayName } from "@/lib/participants/display-name";
import { tripDays } from "@/lib/trips/days";
import { zeigtLiveStatus } from "@/lib/live-status/sichtbar";
import { defaultTripId, defaultDay } from "@/lib/trips/select-default";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { getWeatherForDay } from "@/lib/weather/get-weather";
import { activitiesForDay } from "@/lib/activities/day";
import { groupKey } from "@/lib/activities/groups";
import { saveOptionSelection } from "@/lib/activities/save-option-selection";
import type { ThemeId } from "@/lib/theme/types";
import { DEFAULT_THEME_ID, THEMES, findTheme } from "@/lib/theme/themes";
import { loadThemeId, saveThemeId } from "@/lib/theme/storage";
import { Header } from "./components/header";
import { TripListSheet } from "./components/trip-list-sheet";
import { DaySelector } from "./components/day-selector";
import { LiveStatus } from "./components/live-status";
import { Timeline } from "./components/timeline";
import { Bewertungsrunde } from "./components/bewertungsrunde";
import { NichtsAnstehend } from "./components/nichts-anstehend";
import { MapView } from "./components/map-view";
import { CostsView } from "./components/costs-view";
import { DocumentsView } from "./components/documents-view";
import { ThemeSheet } from "./components/theme-sheet";
import { BottomNav, type Tab } from "./components/bottom-nav";
import styles from "./go-view.module.css";

export function GoView({
  trips,
  activities = [],
  transfers = [],
  optionSelections: initialOptionSelections = {},
  participants = [],
  tripParticipants = [],
  expenses: initialExpenses = [],
  documents: initialDocuments = [],
  pois = [],
  runden = [],
  stimmen = [],
  selfParticipantId = "",
  darfPlanen = false,
  today,
  jetzt,
}: {
  trips: Trip[];
  activities?: Activity[];
  transfers?: Transfer[];
  optionSelections?: Record<string, string>;
  /** Die Personen des Accounts -- zum Benennen im Bereich "Kosten". */
  participants?: ExpensePerson[];
  /** Wer bei welcher Reise mitfaehrt (req-021). */
  tripParticipants?: TripParticipant[];
  expenses?: Expense[];
  /** Die abgelegten Dokumente (req-034) -- unterwegs vor allem fotografierte Tickets. */
  documents?: TripDocument[];
  /**
   * Nur die POIs, ueber die abgestimmt wird oder wurde (req-054) -- der
   * Begleiter sammelt keine POIs, er braucht sie allein fuer die
   * Bewertungsrunde.
   */
  pois?: Poi[];
  /** Die Bewertungsrunden der sichtbaren Reisen (req-054). */
  runden?: Runde[];
  /** Die abgegebenen Stimmen dieser Runden. */
  stimmen?: Stimme[];
  selfParticipantId?: string;
  /**
   * Ob die angemeldete Person auch den Planer darf (req-055) -- nur dann
   * steht im Kopfbereich der Wechsel dorthin.
   */
  darfPlanen?: boolean;
  today: string;
  /**
   * Die lokale Zeit "YYYY-MM-DDTHH:mm" beim Aufbau der Seite, fuer den
   * Live-Status (req-051). Sie kommt vom Server, damit die erste
   * Darstellung im Browser dieselbe ist; danach laeuft die Uhr im Geraet.
   * Ohne Angabe beginnt sie beim Tagesbeginn und springt beim ersten Takt
   * auf die Uhrzeit des Geraets.
   */
  jetzt?: string;
}) {
  const todayDate = useMemo(() => {
    const { year, month, day } = parseIsoDate(today);
    return new Date(year, month - 1, day);
  }, [today]);

  // Die laufende Reise, sonst die Reise der offenen Abstimmung, sonst die
  // uebliche Vorauswahl (req-055): der Begleiter oeffnet dort, wo gerade
  // etwas ansteht.
  const [selectedTripId, setSelectedTripId] = useState(
    () =>
      laufendeReise(trips, today)?.id ??
      offeneAbstimmung(runden, trips)?.tripId ??
      defaultTripId(trips, todayDate),
  );
  const [selectedDate, setSelectedDate] = useState(() => {
    const trip = trips.find((t) => t.id === selectedTripId);
    return trip ? defaultDay(trip, todayDate) : null;
  });
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherReading | null>(null);
  const [optionSelections, setOptionSelections] = useState(
    initialOptionSelections,
  );
  const [expenses, setExpenses] = useState(initialExpenses);
  // Ein unterwegs fotografiertes Ticket steht sofort in der Liste, ohne
  // Neuladen (req-034).
  const [documents, setDocuments] = useState(initialDocuments);
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);

  // Serverseitig gerendert wird immer "Hell" (kein Zugriff auf
  // localStorage); die geraetegebundene Wahl wird erst nach dem Mounten
  // im Client uebernommen, um einen Hydration-Mismatch zu vermeiden.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeId(loadThemeId());
  }, []);

  function selectTheme(id: ThemeId) {
    setThemeId(id);
    setThemeSheetOpen(false);
    saveThemeId(id);
  }

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  // Stabile Referenz, damit die Kartenansicht nur bei tatsaechlichem
  // Tages- oder Reisewechsel neu zentriert (fitBounds), nicht bei jedem
  // unabhaengigen Re-Render (z.B. eintreffendes Wetter).
  const dayActivities = useMemo(() => {
    if (!selectedTrip || !selectedDate) return [];
    return activitiesForDay(activities, selectedTrip.id, selectedDate);
  }, [activities, selectedTrip, selectedDate]);

  useEffect(() => {
    if (!selectedTrip || !selectedDate) return;
    let cancelled = false;
    getWeatherForDay(selectedTrip.mainPlace, selectedDate, today).then(
      (reading) => {
        if (!cancelled) setWeather(reading);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedTrip, selectedDate, today]);

  function selectOption(group: ActivityGroup, activityId: string) {
    setOptionSelections((prev) => ({ ...prev, [groupKey(group)]: activityId }));
    void saveOptionSelection(
      group.tripId,
      group.startAt,
      group.endAt,
      activityId,
    );
  }

  function selectTrip(tripId: string) {
    setSelectedTripId(tripId);
    setTripSheetOpen(false);
    const trip = trips.find((t) => t.id === tripId);
    if (trip) setSelectedDate(defaultDay(trip, todayDate));
  }

  const activeTheme = findTheme(themeId);

  if (!selectedTrip || !selectedDate) {
    // Ohne sichtbare Reise gibt es keinen Kopfbereich -- und nichts, was
    // anstuende (req-055).
    return (
      <div className={styles.app} style={activeTheme.vars as CSSProperties}>
        <main className={styles.content}>
          <NichtsAnstehend />
        </main>
      </div>
    );
  }

  // Zahler und Beteiligte einer Ausgabe sind Teilnehmer der geoeffneten
  // Reise (req-029); die Ausgaben gehoeren ebenso zu genau einer Reise.
  const tripPeople = participants.filter((person) =>
    tripParticipants.some(
      (assignment) =>
        assignment.tripId === selectedTrip.id &&
        assignment.participantId === person.id,
    ),
  );
  const tripExpenses = expenses.filter(
    (expense) => expense.tripId === selectedTrip.id,
  );
  const tripDocuments = documents.filter(
    (document) => document.tripId === selectedTrip.id,
  );

  // Die Bewertungsrunde (req-054): abgestimmt wird ueber die laufende, die
  // "Ohne mich"-Stimmen am Programmpunkt stammen aus jeder Runde der Reise --
  // auch aus einer beendeten.
  const tripRunden = runden.filter((runde) => runde.tripId === selectedTrip.id);
  const bewertungsPersonen = tripPeople.map((person) => ({
    id: person.id,
    name: participantDisplayName(person),
  }));
  const laufende = laufendeRunde(tripRunden, selectedTrip.id);
  const rundenPois = laufende
    ? laufende.poiIds
        .map((poiId) => pois.find((poi) => poi.id === poiId))
        .filter((poi): poi is Poi => poi !== undefined)
    : [];
  const zeigtAbstimmung = laufende !== null && rundenPois.length > 0;
  const ohneMich = ohneMichJeProgrammpunkt(
    dayActivities,
    tripRunden,
    stimmen,
    bewertungsPersonen,
  );

  // Der Begleiter in der Vorbereitung (req-055): solange keine Reise laeuft,
  // zeigt er keinen Plan, sondern die laufende Abstimmung -- und gibt es auch
  // die nicht, den Hinweis, dass gerade nichts ansteht. Die uebrigen Bereiche
  // (Karte, Kosten, Dokumente) bleiben davon unberuehrt: Abgerechnet wird
  // auch noch, wenn die Reise laengst vorbei ist.
  const reiseLaeuft = laufendeReise(trips, today) !== null;
  const zeigtPlan = activeTab === "plan" && reiseLaeuft;

  /** Eine erfasste oder geaenderte Ausgabe, die neueste zuerst. */
  function rememberExpense(saved: Expense) {
    setExpenses((prev) => {
      const ohne = prev.filter((expense) => expense.id !== saved.id);
      return [saved, ...ohne].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    });
  }

  return (
    <div className={styles.app} style={activeTheme.vars as CSSProperties}>
      <Header
        trip={selectedTrip}
        weather={weather}
        darfPlanen={darfPlanen}
        onOpenTripSheet={() => setTripSheetOpen(true)}
        onOpenThemeSheet={() => setThemeSheetOpen(true)}
      />
      {tripSheetOpen && (
        <TripListSheet
          trips={trips}
          today={todayDate}
          selectedTripId={selectedTrip.id}
          onSelect={selectTrip}
          onClose={() => setTripSheetOpen(false)}
        />
      )}
      {themeSheetOpen && (
        <ThemeSheet
          themes={THEMES}
          activeThemeId={themeId}
          onSelect={selectTheme}
          onClose={() => setThemeSheetOpen(false)}
        />
      )}
      {zeigtPlan && (
        <DaySelector
          days={tripDays(selectedTrip)}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
      )}
      <main className={styles.content}>
        {zeigtPlan && zeigtLiveStatus(selectedTrip, today) && (
          <LiveStatus
            tripId={selectedTrip.id}
            activities={activities.filter(
              (activity) => activity.tripId === selectedTrip.id,
            )}
            jetzt={jetzt ?? `${today}T00:00`}
          />
        )}
        {/* Eine laufende Runde steht ueber dem Zeitstrahl -- sie wartet auf
            eine Antwort. Laeuft keine, steht hier auch keine Abstimmung. */}
        {activeTab === "plan" && zeigtAbstimmung && laufende && (
          <Bewertungsrunde
            runde={laufende}
            pois={rundenPois}
            stimmen={stimmen.filter((stimme) => stimme.roundId === laufende.id)}
            personen={bewertungsPersonen}
            selfParticipantId={selfParticipantId}
          />
        )}
        {zeigtPlan && (
          <Timeline
            activities={dayActivities}
            transfers={transfers}
            optionSelections={optionSelections}
            onSelectOption={selectOption}
            ohneMich={ohneMich}
          />
        )}
        {activeTab === "plan" && !reiseLaeuft && !zeigtAbstimmung && (
          <NichtsAnstehend />
        )}
        {activeTab === "map" && (
          <MapView
            days={tripDays(selectedTrip)}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            mainPlace={selectedTrip.mainPlace}
            activities={dayActivities}
            transfers={transfers}
            optionSelections={optionSelections}
          />
        )}
        {activeTab === "costs" && (
          <CostsView
            tripId={selectedTrip.id}
            people={participants}
            tripPeople={tripPeople}
            expenses={tripExpenses}
            selfParticipantId={selfParticipantId}
            onSaved={rememberExpense}
            onRemoved={(removed) =>
              setExpenses((prev) =>
                prev.filter((expense) => expense.id !== removed.id),
              )
            }
          />
        )}
        {activeTab === "documents" && (
          <DocumentsView
            tripId={selectedTrip.id}
            documents={tripDocuments}
            participants={participants}
            onDocumentSaved={(saved) =>
              setDocuments((prev) => [
                saved,
                ...prev.filter((document) => document.id !== saved.id),
              ])
            }
          />
        )}
      </main>
      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  );
}
