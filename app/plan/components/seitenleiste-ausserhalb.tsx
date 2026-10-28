"use client";

import { type PlanAreaId, planAreaPath } from "@/lib/plan/areas";
import type { Trip } from "@/lib/trips/types";
import { defaultTripId } from "@/lib/trips/select-default";
import { PLANER_PATH } from "@/lib/einstieg/ziel";
import { Seitenleiste } from "./seitenleiste";

/**
 * Die Seitenleiste des Planers auf den Seiten, die keinen Planer-Zustand
 * haben (req-096): "Mein Bereich" (req-043) und die "Verwaltung" (req-025).
 *
 * Beide trugen bis req-096 die Kopfleiste. Das war ein Bruch: Die
 * Seitenleiste fuehrt unten zu ihnen hin, und oben angekommen stand ploetzlich
 * ein Menue am Kopf. Seit req-094 ist die Leiste 60 px schmal und kostet auch
 * auf dem Telefon nicht mehr zu viel Breite -- das Argument fuer die
 * Kopfleiste ist damit entfallen.
 *
 * Die Leiste fuehrt durch die Bereiche *einer* Reise. Diese Seiten haben
 * keine, deshalb gilt hier die vorausgewaehlte (siehe
 * lib/trips/select-default.ts): die laufende, sonst die naechste geplante,
 * sonst die zuletzt beendete. Das ist dieselbe Wahl, die der Planer beim
 * Oeffnen trifft -- wer einen Bereich antippt, landet dort, wo er ihn
 * erwartet.
 *
 * Jeder Griff fuehrt in den Planer, denn hier gibt es nichts umzuschalten:
 * Die Seite wechselt, statt ihren Zustand zu aendern.
 */
export function SeitenleisteAusserhalb({
  trips,
  today,
  superAdmin = false,
  abmelden = true,
  navigate = (url: string) => window.location.assign(url),
}: {
  /** Die Reisen des Accounts -- leer heisst: es gibt keine Leiste. */
  trips: Trip[];
  /** Das heutige Datum als "YYYY-MM-DD" -- vom Server, damit es nicht springt. */
  today: string;
  superAdmin?: boolean;
  /** Ob das Abmelden im Fuss steht -- false, wo die Seite es selbst zeigt. */
  abmelden?: boolean;
  /**
   * Der Sprung in den Planer -- in Tests ersetzbar, wie bei den Ansichten
   * dieser Seiten (siehe mein-bereich-view.tsx). `next/navigation` kommt
   * hier nicht in Frage: diese Leiste wird in Ansichten gerendert, die ohne
   * App-Router geprueft werden.
   */
  navigate?: (url: string) => void;
}) {
  // Ohne Reise fuehrt die Leiste ins Leere: ihre Bereiche gehoeren einer
  // Reise, und die Reisewahl waere eine leere Liste. Wer noch keine hat,
  // sieht sie deshalb nicht (wie im Planer, siehe plan-view.tsx).
  // Das Datum kommt als Text vom Server, damit die erste Darstellung im
  // Browser dieselbe ist; die Leiste rechnet damit als Date.
  const todayDate = new Date(`${today}T00:00`);
  const tripId = defaultTripId(trips, todayDate);
  const selectedTrip = trips.find((trip) => trip.id === tripId) ?? null;
  if (!selectedTrip) return null;

  function inDenPlaner(area?: PlanAreaId) {
    navigate(area ? planAreaPath(area) : PLANER_PATH);
  }

  return (
    <Seitenleiste
      trips={trips}
      selectedTrip={selectedTrip}
      today={todayDate}
      superAdmin={superAdmin}
      // Keiner der Bereiche ist offen: diese Seite ist keiner von ihnen.
      activeArea={null}
      abmelden={abmelden}
      // Der Planer waehlt die Reise selbst vor; eine andere hier zu waehlen,
      // waere ohne seinen Zustand nicht zu halten. Der Griff fuehrt deshalb
      // in den Planer, der sie dann oeffnet.
      onSelectTrip={() => inDenPlaner()}
      onSelectArea={(area) => inDenPlaner(area)}
      onCreateTrip={() => inDenPlaner()}
      onOpenTripDetails={() => inDenPlaner("reisedetails")}
    />
  );
}
