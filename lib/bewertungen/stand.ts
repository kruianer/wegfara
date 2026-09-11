import {
  STIMM_WAHLEN,
  type Bewertungsrunde,
  type Stimme,
  type StimmWahl,
} from "./types";

/**
 * Was aus Runden und Stimmen an einem POI angezeigt wird (req-054) -- ohne
 * UI-Bezug, damit Planer und Begleiter dieselbe Rechnung nutzen und keiner
 * von beiden den anderen kennen muss (siehe delivery/stack.md, Conventions).
 */

/** So viel einer Person, wie zum Benennen gebraucht wird. */
export interface BewertendePerson {
  id: string;
  /** Der Name, unter dem sie angezeigt wird (participantDisplayName). */
  name: string;
}

/** Eine abgegebene Stimme mit der Person davor. */
export interface StimmeMitName extends BewertendePerson {
  wahl: StimmWahl;
}

/** Wie oft eine der fuenf Stimmen abgegeben wurde. */
export interface WahlAnzahl {
  wahl: StimmWahl;
  anzahl: number;
}

/** Der Stand eines POI in seiner Runde. */
export interface Bewertungsstand {
  runde: Bewertungsrunde;
  /** Alle fuenf Stimmen mit ihrer Anzahl, auch die mit null. */
  verteilung: WahlAnzahl[];
  /** Wer gestimmt hat, in der Reihenfolge der Teilnehmerliste. */
  abgegeben: StimmeMitName[];
  /** Wer noch nicht gestimmt hat. */
  fehlend: BewertendePerson[];
  /** Wer "Ohne mich" gestimmt hat -- er ist dort nicht dabei. */
  ohneMich: BewertendePerson[];
  /** Die eigene Stimme; null, solange keine abgegeben ist. */
  eigeneWahl: StimmWahl | null;
}

/** Die laufende Runde einer Reise; es gibt hoechstens eine (req-054). */
export function laufendeRunde(
  runden: Bewertungsrunde[],
  tripId: string,
): Bewertungsrunde | null {
  return (
    runden.find(
      (runde) => runde.tripId === tripId && runde.status === "laeuft",
    ) ?? null
  );
}

/**
 * Die Runde, in der dieser POI steht: die laufende, sonst die zuletzt
 * gestartete beendete. Beendete Runden bleiben sichtbar (req-054) -- ihre
 * Stimmen stehen weiter am POI.
 */
export function rundeZuPoi(
  runden: Bewertungsrunde[],
  poiId: string,
): Bewertungsrunde | null {
  const passende = runden.filter((runde) => runde.poiIds.includes(poiId));
  return (
    passende.find((runde) => runde.status === "laeuft") ??
    passende
      .slice()
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ??
    null
  );
}

/**
 * Der Stand eines POI: Verteilung, wer gestimmt hat, wer fehlt und wer nicht
 * dabei ist. null, wenn ueber diesen POI noch nie abgestimmt wurde.
 *
 * `personen` sind die Teilnehmer der Reise -- auch wer noch nicht gestimmt
 * hat, wird genannt.
 */
export function bewertungsstand(
  poiId: string,
  runden: Bewertungsrunde[],
  stimmen: Stimme[],
  personen: BewertendePerson[],
  selbstId = "",
): Bewertungsstand | null {
  const runde = rundeZuPoi(runden, poiId);
  if (!runde) return null;
  return standInRunde(runde, poiId, stimmen, personen, selbstId);
}

/**
 * Derselbe Stand, aber zu einer bestimmten Runde -- der Bereich
 * "Bewertungen" zeigt eine Runde als Ganzes und hat sie deshalb schon
 * (req-063), waehrend die POI-Zeile sie erst zum POI suchen muss.
 */
export function standInRunde(
  runde: Bewertungsrunde,
  poiId: string,
  stimmen: Stimme[],
  personen: BewertendePerson[],
  selbstId = "",
): Bewertungsstand {
  const abgegebene = stimmen.filter(
    (stimme) => stimme.roundId === runde.id && stimme.poiId === poiId,
  );
  const wahlVon = new Map(
    abgegebene.map((stimme) => [stimme.participantId, stimme.wahl]),
  );

  const abgegeben: StimmeMitName[] = [];
  const fehlend: BewertendePerson[] = [];
  const ohneMich: BewertendePerson[] = [];
  for (const person of personen) {
    const wahl = wahlVon.get(person.id);
    if (!wahl) {
      fehlend.push(person);
      continue;
    }
    abgegeben.push({ ...person, wahl });
    if (wahl === "ohne_mich") ohneMich.push(person);
  }

  return {
    runde,
    verteilung: STIMM_WAHLEN.map((wahl) => ({
      wahl,
      anzahl: abgegeben.filter((stimme) => stimme.wahl === wahl).length,
    })),
    abgegeben,
    fehlend,
    ohneMich,
    eigeneWahl: wahlVon.get(selbstId) ?? null,
  };
}

/**
 * Wer bei diesem POI "Ohne mich" gestimmt hat. Steht am POI und -- sobald er
 * verplant ist -- am Programmpunkt, der aus ihm entstanden ist (req-054).
 */
export function ohneMichAmPoi(
  poiId: string,
  runden: Bewertungsrunde[],
  stimmen: Stimme[],
  personen: BewertendePerson[],
): BewertendePerson[] {
  return bewertungsstand(poiId, runden, stimmen, personen)?.ohneMich ?? [];
}

/**
 * Wer bei einem verplanten POI nicht dabei ist, je Programmpunkt. Der
 * Zeitstrahl kennt nur Programmpunkte -- die Zuordnung zum POI steht an
 * `activity.poiId` (req-039).
 */
export function ohneMichJeProgrammpunkt(
  activities: { id: string; poiId?: string }[],
  runden: Bewertungsrunde[],
  stimmen: Stimme[],
  personen: BewertendePerson[],
): Record<string, string[]> {
  const eintraege: Record<string, string[]> = {};
  for (const activity of activities) {
    if (!activity.poiId) continue;
    const namen = ohneMichAmPoi(activity.poiId, runden, stimmen, personen).map(
      (person) => person.name,
    );
    if (namen.length > 0) eintraege[activity.id] = namen;
  }
  return eintraege;
}
