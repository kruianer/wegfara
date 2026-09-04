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
import { tripDays } from "@/lib/trips/days";
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
import { Timeline } from "./components/timeline";
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
  selfParticipantId = "",
  guest = false,
  today,
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
  selfParticipantId?: string;
  /**
   * Ob hier ein Gast mitliest (req-038). Er sieht Plan und Karte der einen
   * freigegebenen Reise, sonst nichts: keine Kosten, keine Dokumente, keine
   * Wahl von Alternativen und kein Konto. Das ist die Anzeige -- der Schutz
   * liegt darin, dass eine Gast-Sitzung keine Teilnehmer-Sitzung ist und
   * jede Schnittstelle sie abweist.
   */
  guest?: boolean;
  today: string;
}) {
  const todayDate = useMemo(() => {
    const { year, month, day } = parseIsoDate(today);
    return new Date(year, month - 1, day);
  }, [today]);

  const [selectedTripId, setSelectedTripId] = useState(() =>
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

  if (!selectedTrip || !selectedDate) {
    return null;
  }

  const activeTheme = findTheme(themeId);

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
        guest={guest}
        onOpenTripSheet={() => setTripSheetOpen(true)}
        onOpenThemeSheet={() => setThemeSheetOpen(true)}
      />
      {/* Ein Gast hat genau eine Reise (req-038) -- es gibt nichts zu
          wechseln. */}
      {!guest && tripSheetOpen && (
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
      {activeTab === "plan" && (
        <DaySelector
          days={tripDays(selectedTrip)}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
      )}
      <main className={styles.content}>
        {activeTab === "plan" && (
          <Timeline
            activities={dayActivities}
            transfers={transfers}
            optionSelections={optionSelections}
            onSelectOption={selectOption}
            readOnly={guest}
          />
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
        {!guest && activeTab === "costs" && (
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
        {!guest && activeTab === "documents" && (
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
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        guest={guest}
      />
    </div>
  );
}
