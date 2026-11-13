"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
import {
  laufendeReise,
  mitreisendeZurReise,
  offeneAbstimmung,
} from "@/lib/einstieg/ziel";
import { darfMitreisendeVerwalten } from "@/lib/trip-participants/rules";
import { participantDisplayName } from "@/lib/participants/display-name";
import { tripDays } from "@/lib/trips/days";
import { zeigtLiveStatus } from "@/lib/live-status/sichtbar";
import { planEintragZu } from "@/lib/live-status/plan-eintrag";
import { defaultTripId, defaultDay } from "@/lib/trips/select-default";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { getWeatherForDay } from "@/lib/weather/get-weather";
import { activitiesForDay } from "@/lib/activities/day";
import { groupKey, partsOfGroupKey } from "@/lib/activities/groups";
import { saveOptionSelection } from "@/lib/activities/save-option-selection";
import {
  bestaetigeOptionSelectionEcho,
  ladeBestaetigteOptionSelections,
  ladeOptionSelectionEcho,
  merkeOptionSelectionEcho,
  vergissOptionSelectionEcho,
} from "@/lib/activities/option-selection-echo";
import type { ThemeId } from "@/lib/theme/types";
import { DEFAULT_THEME_ID, THEMES, findTheme } from "@/lib/theme/themes";
import { loadThemeId, saveThemeId } from "@/lib/theme/storage";
import { useWindowWidth } from "@/components/use-window-width";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";
import { Header } from "./components/header";
import { TripListSheet } from "./components/trip-list-sheet";
import { DaySelector } from "./components/day-selector";
import { LiveStatus } from "./components/live-status";
import { useLiveLage } from "./components/use-live-lage";
import { Timeline } from "./components/timeline";
import { Bewertungsrunde } from "./components/bewertungsrunde";
import { NichtsAnstehend } from "./components/nichts-anstehend";
import { MapView } from "./components/map-view";
import { CostsView } from "./components/costs-view";
import { DocumentsView } from "./components/documents-view";
import { MehrSheet } from "./components/mehr-sheet";
import { BottomNav, type Tab } from "./components/bottom-nav";
import styles from "./go-view.module.css";
import bildlauf from "@/components/bildlauf.module.css";

export function GoView({
  trips,
  reiseId,
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
  accountAdmin = false,
  geteilteReisen = [],
  today,
  jetzt,
  gelesenUm,
}: {
  trips: Trip[];
  /**
   * Die Reise, bei der der Begleiter aufgehen soll -- gesetzt beim
   * "Zurueck" aus "Wer faehrt mit" (req-087). Eine unbekannte oder nicht
   * sichtbare zaehlt nicht; dann gilt die uebliche Vorauswahl.
   */
  reiseId?: string;
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
   * Nur die POIs, die der Begleiter braucht -- er sammelt keine: die, ueber
   * die abgestimmt wird oder wurde (req-054), und die, aus denen die
   * Programmpunkte des Plans entstanden sind (req-079, fuer Fotos und Links
   * ihrer Kacheln).
   */
  pois?: Poi[];
  /** Die Bewertungsrunden der sichtbaren Reisen (req-054). */
  runden?: Runde[];
  /** Die abgegebenen Stimmen dieser Runden. */
  stimmen?: Stimme[];
  selfParticipantId?: string;
  /**
   * Ob die angemeldete Person auch den Planer darf (req-055) -- nur dann
   * steht unter "Mehr" der Wechsel dorthin (bug-063).
   */
  darfPlanen?: boolean;
  /**
   * Ob die angemeldete Person Account-Admin ist (req-027) -- sie darf "Wer
   * faehrt mit" jeder Reise bearbeiten, nicht nur der, die sie fuehrt
   * (req-087).
   */
  accountAdmin?: boolean;
  /** Die Reisen, fuer die die angemeldete Person "Meine Position teilen" eingeschaltet hat (req-050). */
  geteilteReisen?: string[];
  today: string;
  /**
   * Die lokale Zeit "YYYY-MM-DDTHH:mm" beim Aufbau der Seite, fuer den
   * Live-Status (req-051). Sie kommt vom Server, damit die erste
   * Darstellung im Browser dieselbe ist; danach laeuft die Uhr im Geraet.
   * Ohne Angabe beginnt sie beim Tagesbeginn und springt beim ersten Takt
   * auf die Uhrzeit des Geraets.
   */
  jetzt?: string;
  /**
   * Wann der Server die Daten dieser Seite gelesen hat, nach seiner Uhr
   * (bug-073). Ohne Angabe gilt sein Stand fuer jede bereits bestaetigte
   * Wahl als der neueste.
   */
  gelesenUm?: number;
}) {
  const todayDate = useMemo(() => {
    const { year, month, day } = parseIsoDate(today);
    return new Date(year, month - 1, day);
  }, [today]);

  // Die ausdruecklich genannte Reise (req-087, "Zurueck" aus "Wer faehrt
  // mit"), sonst die laufende, sonst die Reise der offenen Abstimmung, sonst
  // die uebliche Vorauswahl (req-055): der Begleiter oeffnet dort, wo gerade
  // etwas ansteht.
  const [selectedTripId, setSelectedTripId] = useState(
    () =>
      trips.find((trip) => trip.id === reiseId)?.id ??
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
  // Gerendert wird zuerst der Stand des Servers; das Echo aus dem
  // localStorage kommt erst nach dem Mounten dazu (siehe unten).
  const [optionSelections, setOptionSelections] = useState(
    initialOptionSelections,
  );
  const [optionProblem, setOptionProblem] = useState<string | null>(null);
  const [expenses, setExpenses] = useState(initialExpenses);
  // Ein unterwegs fotografiertes Ticket steht sofort in der Liste, ohne
  // Neuladen (req-034).
  const [documents, setDocuments] = useState(initialDocuments);
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [mehrOpen, setMehrOpen] = useState(false);

  // Der Begleiter laeuft im Regelfall auf dem Smartphone -- bis zur ersten
  // Messung gilt deshalb "schmal", damit der Wechsel in den Planer unter
  // "Mehr" dort nicht kurz aufblitzt (bug-035).
  const fensterBreite = useWindowWidth(0);
  // Auf einem schmalen Bildschirm ergibt der Wechsel keinen Sinn: der Planer
  // verwiese dort nur auf einen breiteren (siehe app/plan/components/
  // narrow-notice.tsx). Ab seiner Mindestbreite gehoert der Weg sichtbar zu
  // sein -- dieselbe Zahl entscheidet auf beiden Seiten (bug-035).
  const zeigtWechsel = darfPlanen && fensterBreite >= PLANNER_MIN_WIDTH_PX;

  // Serverseitig gerendert wird immer "Hell" (kein Zugriff auf
  // localStorage); die geraetegebundene Wahl wird erst nach dem Mounten
  // im Client uebernommen, um einen Hydration-Mismatch zu vermeiden.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeId(loadThemeId());
  }, []);

  function selectTheme(id: ThemeId) {
    setThemeId(id);
    saveThemeId(id);
  }

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  // Uhr und Lage des Live-Status (req-051) -- dieselben fuer die Linien im
  // Zeitstrahl (req-086), damit beide nie Unterschiedliches sagen. Gefragt
  // wird nur, solange der Live-Status ueberhaupt zu sehen ist.
  const zeigtLive =
    activeTab === "plan" &&
    selectedTrip !== undefined &&
    zeigtLiveStatus(selectedTrip, today);
  const { zeit, lage } = useLiveLage(
    selectedTrip?.id ?? "",
    jetzt ?? `${today}T00:00`,
    zeigtLive,
  );
  const tripActivities = useMemo(
    () => activities.filter((activity) => activity.tripId === selectedTrip?.id),
    [activities, selectedTrip],
  );
  const eintrag = useMemo(
    () => planEintragZu(tripActivities, zeit),
    [tripActivities, zeit],
  );

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

  // Das Echo (bug-060): Wahlen, die auf diesem Geraet getroffen, aber beim
  // letzten Laden vielleicht noch nicht angekommen waren -- einmal beim
  // Mounten gelesen, nicht bei jedem Rendern neu. Erst hier und nicht schon
  // im ersten Rendern (bug-072): der Server kennt kein localStorage, und
  // React uebernimmt bei der Hydration abweichende Attribute nicht -- die
  // Knoepfe blieben auf dem Stand des Servers stehen, obwohl das Echo
  // gelesen war.
  //
  // Stimmt ein mitgebrachtes Echo mit dem serverseitigen Stand ueberein,
  // hat der Schreibvorgang von vorhin angekommen -- das Echo faellt weg. Weicht
  // es ab, ist er vermutlich am Neuladen vorbeigelaufen (bug-060) und wird
  // hier nachgeholt, bevor ein anderes Geraet eine andere Wahl trifft.
  //
  // Eine bereits bestaetigte Wahl (bug-073) kam womoeglich erst an, als der
  // Server diese Seite schon gelesen hatte: Das Neuladen fragt die neue Seite
  // an, waehrend die alte noch lebt und die Bestaetigung empfaengt. Hat er
  // die Wahl erst nach dem Lesen gespeichert, fehlt sie in seinem Stand und
  // kommt aus dem Geraet; hat er sie davor gespeichert, gilt sein Stand --
  // auch wenn inzwischen jemand anders gewaehlt hat.
  useEffect(() => {
    const echo = ladeOptionSelectionEcho();
    const uebernehmen: Record<string, string> = {};
    for (const [key, wahl] of Object.entries(
      ladeBestaetigteOptionSelections(),
    )) {
      vergissOptionSelectionEcho(key);
      if (gelesenUm !== undefined && gelesenUm < wahl.um) {
        uebernehmen[key] = wahl.activityId;
      }
    }
    for (const [key, activityId] of Object.entries(echo)) {
      uebernehmen[key] = activityId;
      if (initialOptionSelections[key] === activityId) {
        vergissOptionSelectionEcho(key);
        continue;
      }
      const { tripId, startAt, endAt } = partsOfGroupKey(key);
      saveOptionSelection(tripId, startAt, endAt, activityId).then(
        (gespeichert) => {
          if (gespeichert) {
            bestaetigeOptionSelectionEcho(
              key,
              activityId,
              gespeichert.gespeichertUm,
            );
          }
        },
      );
    }
    if (Object.keys(uebernehmen).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptionSelections((prev) => ({ ...prev, ...uebernehmen }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ob die Seite gerade verlassen wird, etwa durch ein Neuladen (bug-072).
  // Der Browser bricht dabei einen noch laufenden Schreibvorgang ab -- das
  // ist kein Scheitern, das die Wahl zuruecknimmt: das Echo bleibt liegen,
  // und die naechste Seite holt den Schreibvorgang nach. `pagehide` kommt
  // vor dem Abbruch; kehrt die Seite aus dem Zwischenspeicher des Browsers
  // zurueck, gilt sie wieder als geoeffnet.
  const verlaesstDieSeite = useRef(false);
  useEffect(() => {
    const verlassen = () => {
      verlaesstDieSeite.current = true;
    };
    const zurueck = () => {
      verlaesstDieSeite.current = false;
    };
    window.addEventListener("pagehide", verlassen);
    window.addEventListener("pageshow", zurueck);
    return () => {
      window.removeEventListener("pagehide", verlassen);
      window.removeEventListener("pageshow", zurueck);
    };
  }, []);

  async function selectOption(group: ActivityGroup, activityId: string) {
    const key = groupKey(group);
    const vorherige = optionSelections[key] ?? group.activities[0].id;
    setOptionProblem(null);
    setOptionSelections((prev) => ({ ...prev, [key]: activityId }));
    merkeOptionSelectionEcho(key, activityId);

    const gespeichert = await saveOptionSelection(
      group.tripId,
      group.startAt,
      group.endAt,
      activityId,
    );
    // Angekommen: Das Echo faellt weg, die Bestaetigung bleibt fuer ein
    // Neuladen liegen, das sie ueberholt hat (bug-073).
    if (gespeichert) {
      bestaetigeOptionSelectionEcho(key, activityId, gespeichert.gespeichertUm);
      return;
    }
    if (verlaesstDieSeite.current) return;
    vergissOptionSelectionEcho(key);

    setOptionSelections((prev) => ({ ...prev, [key]: vorherige }));
    setOptionProblem("Die Wahl konnte nicht gespeichert werden.");
  }

  function selectTrip(tripId: string) {
    setSelectedTripId(tripId);
    setTripSheetOpen(false);
    setOptionProblem(null);
    const trip = trips.find((t) => t.id === tripId);
    if (trip) setSelectedDate(defaultDay(trip, todayDate));
  }

  const activeTheme = findTheme(themeId);

  if (!selectedTrip || !selectedDate) {
    // Ohne sichtbare Reise gibt es keinen Kopfbereich -- und nichts, was
    // anstuende (req-055).
    return (
      <div className={styles.app} style={activeTheme.vars as CSSProperties}>
        <main className={`${styles.content} ${bildlauf.bildlauf}`}>
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

  // Der Plan gehoert zur geoeffneten Reise, nicht zum heutigen Tag (bug-054):
  // Er steht auch dann da, wenn die Reise noch in Planung ist und ihr Zeitraum
  // in der Zukunft liegt -- der Reiseleiter muss sehen koennen, was die
  // Mitreisenden spaeter sehen werden. req-055 band ihn an eine laufende
  // Reise; das liess den Begleiter in der Vorbereitung leer dastehen.
  // Was an einem Reisetag noch nicht verplant ist, sagt der Zeitstrahl selbst
  // ("Noch nichts geplant"); der Hinweis "Gerade steht nichts an" bleibt dem
  // einen Fall, in dem es wirklich nichts zu zeigen gibt -- keine sichtbare
  // Reise, siehe oben.
  const zeigtPlan = activeTab === "plan";

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
        onOpenTripSheet={() => setTripSheetOpen(true)}
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
      {mehrOpen && (
        <MehrSheet
          zeigtWechsel={zeigtWechsel}
          // Dieselbe Regel wie fuer die Karte im Planer (req-087): der
          // Reiseleiter der geoeffneten Reise und jeder Account-Admin.
          mitreisendeHref={
            darfMitreisendeVerwalten({
              tripParticipants,
              tripId: selectedTrip.id,
              participantId: selfParticipantId,
              accountAdmin,
            })
              ? mitreisendeZurReise(selectedTrip.id)
              : null
          }
          themes={THEMES}
          activeThemeId={themeId}
          onSelectTheme={selectTheme}
          onClose={() => setMehrOpen(false)}
        />
      )}
      {zeigtPlan && (
        <DaySelector
          days={tripDays(selectedTrip)}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
      )}
      <main className={`${styles.content} ${bildlauf.bildlauf}`}>
        {zeigtLive && (
          <LiveStatus activities={tripActivities} zeit={zeit} lage={lage} />
        )}
        {/* Eine laufende Runde steht ueber dem Zeitstrahl -- sie wartet auf
            eine Antwort. Laeuft keine, steht hier auch keine Abstimmung. */}
        {zeigtPlan && zeigtAbstimmung && laufende && (
          <Bewertungsrunde
            runde={laufende}
            pois={rundenPois}
            stimmen={stimmen.filter((stimme) => stimme.roundId === laufende.id)}
            personen={bewertungsPersonen}
            selfParticipantId={selfParticipantId}
          />
        )}
        {zeigtPlan && optionProblem && (
          <p
            className={styles.optionProblem}
            role="alert"
            data-testid="option-hinweis"
          >
            {optionProblem}
          </p>
        )}
        {zeigtPlan && (
          <Timeline
            activities={dayActivities}
            transfers={transfers}
            pois={pois}
            optionSelections={optionSelections}
            onSelectOption={selectOption}
            ohneMich={ohneMich}
            isToday={selectedDate === today}
            live={
              zeigtLive && selectedDate === today
                ? { zeit, eintrag, lage }
                : null
            }
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
            tripId={selectedTrip.id}
            berechtigt={zeigtLiveStatus(selectedTrip, today)}
            initialGeteilt={geteilteReisen.includes(selectedTrip.id)}
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
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenMore={() => setMehrOpen(true)}
      />
    </div>
  );
}
