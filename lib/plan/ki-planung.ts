import type {
  Activity,
  ActivityPosition,
  ActivityType,
} from "@/lib/activities/types";
import type { Poi, PoiStatus } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import type { Wegpunkt } from "@/lib/routing/client";
import { POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import { POI_TYPE_LABEL } from "@/lib/pois/type-meta";
import { isPlannablePoi } from "@/lib/pois/unplanned";
import { tripDays } from "@/lib/trips/days";
import { REISETEMPO_REGELN } from "@/lib/trips/tempo";
import { activityTypeForPoi } from "./plan-poi";
import {
  geschaetzteFahrzeitMinuten,
  lueckeMinutenZwischen,
  poiDauerMinuten,
  tagesPaare,
  verteilePois,
  type Fahrzeitschaetzung,
  type GeplanterPunkt,
  type Verteilung,
} from "./tagesplan";

/**
 * "KI planen lassen" (req-056): die KI verteilt die POIs mit Status
 * "Gesetzt" und "Wahrscheinlich" auf die Reisetage, die Rechnung hier bringt
 * sie in eine Abfolge und haelt die Regeln des Reisetempos ein.
 *
 * Gespeichert wird dabei nichts: das Ergebnis ist ein Vorschlag, den der
 * Reiseleiter uebernimmt oder verwirft (siehe delivery/vision.md -- im
 * Zweifel vorschlagen statt selbst umbauen).
 *
 * Die beiden Aussenanbindungen -- das Sprachmodell und der Routing-Dienst --
 * kommen als Schnittstellen herein (lib/ai/, lib/routing/), damit diese Logik
 * ohne Netz und ohne Kosten pruefbar bleibt.
 */

/** Weicht die echte Fahrzeit so weit ab, wird neu verteilt (req-056). */
export const FAHRZEIT_ABWEICHUNG_MINUTEN = 20;

/** Hoechstens fuenfmal wird neu verteilt (req-056). */
export const MAX_NEUVERTEILUNGEN = 5;

/** Die Reihenfolge der Wichtigkeit: "Gesetzt" hat Vorrang (req-056). */
const STATUS_RANG: Partial<Record<PoiStatus, number>> = {
  gesetzt: 0,
  wahrscheinlich: 1,
};

/** Ein Programmpunkt des Vorschlags -- noch nichts davon ist gespeichert. */
export interface VorschlagPunkt {
  /**
   * Der bestehende Programmpunkt dahinter, oder null bei einem neuen. Beim
   * Uebernehmen entscheidet das darueber, ob er angelegt oder verschoben
   * wird -- ein neu geordneter POI bekommt keinen zweiten Programmpunkt.
   */
  activityId: string | null;
  /** Der POI dahinter; null bei einem bestehenden Programmpunkt ohne POI. */
  poiId: string | null;
  type: ActivityType;
  title: string;
  shortText: string;
  longText: string;
  startAt: string;
  endAt: string;
  position?: ActivityPosition;
  /** Ob er unveraendert an seiner Stelle bleibt -- dann ist nichts zu tun. */
  unveraendert: boolean;
}

export interface Planvorschlag {
  punkte: VorschlagPunkt[];
  /** Wie viele POIs keinen Platz fanden (req-056). */
  ohnePlatz: number;
  /** Wo es eng bleibt -- je eine Zeile (req-056). */
  engeStellen: string[];
}

/** Die beiden Aussenanbindungen der Planung (siehe stack.md). */
export interface PlanungsDeps {
  /** Das Sprachmodell: es schlaegt vor, welche POIs auf denselben Tag gehoeren. */
  gruppiere: (prompt: string) => Promise<string | null>;
  /** Die echte Fahrzeit zwischen zwei Stellen; null, wenn sie unbekannt bleibt. */
  fahrzeitMinuten: (von: Wegpunkt, nach: Wegpunkt) => Promise<number | null>;
}

export interface PlanungsParams {
  trip: Trip;
  /** Alle POIs der Reise. */
  pois: Poi[];
  /** Alle bestehenden Programmpunkte der Reise. */
  activities: Activity[];
  /** Ob auch bereits verplante Programmpunkte neu geordnet werden (req-056). */
  neuOrdnen: boolean;
}

function nachWichtigkeit(a: Poi, b: Poi): number {
  const rang = (STATUS_RANG[a.status] ?? 9) - (STATUS_RANG[b.status] ?? 9);
  return rang !== 0 ? rang : a.number - b.number;
}

/**
 * Die POIs, die dieser Lauf verteilt (req-056): "Gesetzt" und
 * "Wahrscheinlich", die wichtigsten zuerst. Ohne das Haekchen bleiben die
 * bereits verplanten aussen vor -- die KI fuellt dann nur die Luecken.
 */
export function zuVerplanendePois(params: PlanungsParams): Poi[] {
  const verplanbar = params.pois
    .filter((poi) => poi.tripId === params.trip.id && isPlannablePoi(poi))
    .sort(nachWichtigkeit);
  if (params.neuOrdnen) return verplanbar;

  const verplant = new Set(
    params.activities
      .map((activity) => activity.poiId)
      .filter((poiId): poiId is string => Boolean(poiId)),
  );
  return verplanbar.filter((poi) => !verplant.has(poi.id));
}

/**
 * Die Programmpunkte, die stehen bleiben. Ohne das Haekchen sind das alle;
 * mit ihm bleiben die, die aus keinem verplanbaren POI stammen -- eine
 * Anreise oder ein von Hand angelegter Programmpunkt laesst sich aus einem
 * POI nicht wiederherstellen und wird deshalb nie angetastet.
 *
 * Hat ein POI mehr als einen Programmpunkt, wird nur der erste neu geordnet;
 * die uebrigen bleiben liegen, statt beim Uebernehmen doppelt zu erscheinen.
 */
export function festeProgrammpunkte(
  params: PlanungsParams,
  zuVerplanen: Poi[],
): Activity[] {
  if (!params.neuOrdnen) return params.activities;

  const umplanbar = new Set(zuVerplanen.map((poi) => poi.id));
  const freigegeben = new Set<string>();
  return params.activities.filter((activity) => {
    if (!activity.poiId || !umplanbar.has(activity.poiId)) return true;
    if (freigegeben.has(activity.poiId)) return true;
    freigegeben.add(activity.poiId);
    return false;
  });
}

/** Der Prompt, mit dem die KI die POIs auf die Reisetage verteilt (req-056). */
export function buildGruppenPrompt(params: {
  trip: Trip;
  tage: string[];
  pois: Poi[];
}): string {
  const regeln = REISETEMPO_REGELN[params.trip.tempo];
  const lines = [
    `Du hilfst bei der Reiseplanung fuer „${params.trip.title}“ rund um ${params.trip.mainPlace.name}.`,
    `Verteile die folgenden Orte auf ${params.tage.length} Reisetage (${params.tage.join(", ")}):`,
    ...params.pois.map(
      (poi) =>
        `${poi.number}. ${poi.name} (${POI_TYPE_LABEL[poi.type]}, ${poi.ort}, ` +
        `${poi.position.lat.toFixed(4)}/${poi.position.lng.toFixed(4)}, ` +
        `etwa ${poiDauerMinuten(poi)} Minuten, Status ${POI_STATUS_LABEL[poi.status]})`,
    ),
    "Regeln:",
    "- Was nah beieinanderliegt, gehoert auf denselben Tag.",
    "- Nicht dreimal dasselbe an einem Tag: bringe Abwechslung hinein.",
    `- Ein Tag umfasst hoechstens ${regeln.tageslaengeStunden} Stunden Programm.`,
    `- Hoechstens ${regeln.maxGleicheTypen} Orte desselben Typs je Tag; Restaurant und Hotel zaehlen nicht mit.`,
    "- Orte mit Status „Gesetzt“ haben Vorrang vor „Wahrscheinlich“.",
    "- Verteile ueber alle Reisetage; kein Tag bleibt leer, solange Orte uebrig sind.",
    `Antworte ausschliesslich als JSON-Objekt der Form {"tage": [[1, 4], [2, 3]]} -- je Reisetag eine Liste der Nummern, in der Reihenfolge der Reisetage, ohne weiteren Text.`,
  ];
  return lines.join("\n");
}

/**
 * Liest die Tagesgruppen aus der Textantwort der KI. Liefert null, wenn sich
 * daraus nichts lesen laesst -- dann ist der Lauf fehlgeschlagen, und der
 * Plan bleibt unveraendert (wie bei der KI-Suche, req-014).
 */
export function parseTagesgruppen(
  raw: string,
  pois: Poi[],
  tageAnzahl: number,
): Map<string, number> | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  const tage = (parsed as Record<string, unknown> | null)?.tage;
  if (!Array.isArray(tage)) return null;

  const nachNummer = new Map(pois.map((poi) => [poi.number, poi]));
  const hinweis = new Map<string, number>();
  tage.slice(0, tageAnzahl).forEach((gruppe, index) => {
    if (!Array.isArray(gruppe)) return;
    for (const wert of gruppe) {
      const poi = nachNummer.get(Number(wert));
      if (poi && !hinweis.has(poi.id)) hinweis.set(poi.id, index);
    }
  });
  return hinweis;
}

/** Ein Schluessel, unter dem eine gemessene Fahrzeit wiedergefunden wird. */
function wegSchluessel(von: ActivityPosition, nach: ActivityPosition): string {
  return `${von.lat},${von.lng}->${nach.lat},${nach.lng}`;
}

/**
 * Holt die echten Fahrzeiten der Tagesgruppen (req-056, zweite Stufe) und
 * merkt sie sich. Liefert true, wenn mindestens eine mehr als 20 Minuten
 * ueber der geschaetzten liegt -- dann wird neu verteilt.
 */
async function messeWege(
  verteilung: Verteilung,
  deps: PlanungsDeps,
  gemessen: Map<string, number>,
): Promise<boolean> {
  let abweichung = false;

  for (const [von, nach] of tagesPaare(verteilung.punkte)) {
    const schluessel = wegSchluessel(von.poi.position, nach.poi.position);
    if (gemessen.has(schluessel)) continue;

    const echt = await deps.fahrzeitMinuten(
      von.poi.position,
      nach.poi.position,
    );
    // Ist der Dienst stumm, bleibt es bei der Schaetzung -- ein erfundener
    // Wert waere schlechter als der geschaetzte (vgl. req-052).
    if (echt === null) continue;

    gemessen.set(schluessel, echt);
    const geschaetzt = geschaetzteFahrzeitMinuten(
      von.poi.position,
      nach.poi.position,
    );
    if (echt > geschaetzt + FAHRZEIT_ABWEICHUNG_MINUTEN) abweichung = true;
  }

  return abweichung;
}

/**
 * Wo die gemessene Fahrzeit nicht in die geplante Luecke passt (req-056).
 * Nach einer Neuverteilung ist das die Ausnahme -- die Luecken rechnen dann
 * mit den gemessenen Zeiten. Uebrig bleibt, was auch der fuenfte Anlauf nicht
 * mehr auffangen konnte; genau darauf weist der Vorschlag hin.
 */
export function engeStellen(
  verteilung: Verteilung,
  gemessen: Map<string, number>,
): string[] {
  const stellen: string[] = [];

  for (const [von, nach] of tagesPaare(verteilung.punkte)) {
    const echt = gemessen.get(
      wegSchluessel(von.poi.position, nach.poi.position),
    );
    if (echt === undefined) continue;

    const luecke = lueckeMinutenZwischen(von, nach);
    if (echt <= luecke) continue;
    stellen.push(
      `„${von.poi.name}“ → „${nach.poi.name}“: ${Math.round(echt)} min Fahrzeit, nur ${luecke} min Lücke.`,
    );
  }

  return stellen;
}

/**
 * Wie gut ein Plan ist: zuerst zaehlt, wo es eng bleibt -- ein Tag, dessen
 * Fahrzeiten nicht aufgehen, ist kein guter Plan, auch wenn mehr darin steht.
 * Bei Gleichstand gewinnt der Plan mit mehr verplanten POIs.
 */
function punktzahl(verteilung: Verteilung, gemessen: Map<string, number>) {
  return {
    verplant: verteilung.punkte.length,
    eng: engeStellen(verteilung, gemessen).length,
  };
}

function istBesser(
  kandidat: { verplant: number; eng: number },
  bisher: { verplant: number; eng: number },
): boolean {
  return kandidat.eng !== bisher.eng
    ? kandidat.eng < bisher.eng
    : kandidat.verplant > bisher.verplant;
}

/** Ein bestehender Programmpunkt, wie er unveraendert im Vorschlag steht. */
function alsFesterPunkt(activity: Activity): VorschlagPunkt {
  return {
    activityId: activity.id,
    poiId: activity.poiId ?? null,
    type: activity.type,
    title: activity.title,
    shortText: activity.shortText,
    longText: activity.longText,
    startAt: activity.startAt,
    endAt: activity.endAt,
    position: activity.position,
    unveraendert: true,
  };
}

/** Ein verplanter POI als Programmpunkt des Vorschlags. */
function alsGeplanterPunkt(
  punkt: GeplanterPunkt,
  bestehend: Activity | undefined,
): VorschlagPunkt {
  return {
    activityId: bestehend?.id ?? null,
    poiId: punkt.poi.id,
    type: activityTypeForPoi(punkt.poi.type),
    title: punkt.poi.name,
    shortText: punkt.poi.shortText ?? "",
    longText: punkt.poi.longText ?? "",
    startAt: punkt.startAt,
    endAt: punkt.endAt,
    position: punkt.poi.position,
    unveraendert:
      bestehend?.startAt === punkt.startAt && bestehend?.endAt === punkt.endAt,
  };
}

/**
 * Der Planvorschlag (req-056). Liefert null, wenn die KI keine brauchbare
 * Antwort gibt -- dann bleibt der Plan unveraendert, und ein Hinweis nennt
 * den Grund.
 *
 * Zuerst wird nach Luftlinie verteilt, danach werden die echten Fahrzeiten
 * der entstandenen Tagesgruppen geholt. Weicht eine um mehr als 20 Minuten
 * ab, wird mit den gemessenen Zeiten neu verteilt -- hoechstens fuenfmal.
 * Am Ende steht der beste gefundene Plan samt Hinweis, wo es eng bleibt.
 */
export async function erstellePlanvorschlag(
  params: PlanungsParams,
  deps: PlanungsDeps,
): Promise<Planvorschlag | null> {
  const zuVerplanen = zuVerplanendePois(params);
  const feste = festeProgrammpunkte(params, zuVerplanen);
  const tage = tripDays(params.trip).map((tag) => tag.date);

  const antwort = await deps.gruppiere(
    buildGruppenPrompt({ trip: params.trip, tage, pois: zuVerplanen }),
  );
  if (antwort === null) return null;
  const hinweis = parseTagesgruppen(antwort, zuVerplanen, tage.length);
  if (!hinweis) return null;

  // Was einmal gemessen wurde, gilt ab dann statt der Schaetzung -- so
  // rechnet die naechste Verteilung mit den echten Fahrzeiten (req-056).
  const gemessen = new Map<string, number>();
  const fahrzeit: Fahrzeitschaetzung = (von, nach) =>
    gemessen.get(wegSchluessel(von, nach)) ??
    geschaetzteFahrzeitMinuten(von, nach);

  let bester: Verteilung | null = null;
  let besteZahl = { verplant: -1, eng: Number.MAX_SAFE_INTEGER };

  for (let runde = 0; runde <= MAX_NEUVERTEILUNGEN; runde += 1) {
    const verteilung = verteilePois({
      pois: zuVerplanen,
      tage,
      regeln: REISETEMPO_REGELN[params.trip.tempo],
      feste,
      fahrzeit,
      start: params.trip.mainPlace,
      hinweis,
    });

    // Erst messen, dann bewerten: ein Plan mit zu knappen Fahrzeiten soll
    // nicht deshalb gewinnen, weil seine Wege noch geschaetzt waren.
    const abweichung = await messeWege(verteilung, deps, gemessen);
    const zahl = punktzahl(verteilung, gemessen);
    if (!bester || istBesser(zahl, besteZahl)) {
      bester = verteilung;
      besteZahl = zahl;
    }

    if (!abweichung) break;
  }

  const verteilung = bester as Verteilung;
  // Ein neu geordneter POI behaelt seinen Programmpunkt und bekommt keinen
  // zweiten (req-056: die KI ordnet die bestehenden neu, sie verdoppelt sie
  // nicht).
  const bestehendeJePoi = new Map<string, Activity>();
  for (const activity of params.activities) {
    if (activity.poiId && !bestehendeJePoi.has(activity.poiId)) {
      bestehendeJePoi.set(activity.poiId, activity);
    }
  }
  const festeIds = new Set(feste.map((activity) => activity.id));

  const punkte = [
    ...feste.map(alsFesterPunkt),
    ...verteilung.punkte.map((punkt) => {
      const bestehend = bestehendeJePoi.get(punkt.poi.id);
      return alsGeplanterPunkt(
        punkt,
        bestehend && !festeIds.has(bestehend.id) ? bestehend : undefined,
      );
    }),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt));

  return {
    punkte,
    ohnePlatz: verteilung.ohnePlatz.length,
    engeStellen: engeStellen(verteilung, gemessen),
  };
}

/**
 * Der Vorschlag als Programmpunkte, wie ihn der Zeitstrahl zur Ansicht zeigt
 * (req-056). Die Kennungen der neuen sind erfunden und gelten nur fuer die
 * Anzeige -- gespeichert ist davon nichts.
 */
export function vorschlagAlsActivities(
  vorschlag: Planvorschlag,
  tripId: string,
): Activity[] {
  return vorschlag.punkte.map((punkt, index) => ({
    id: punkt.activityId ?? `vorschlag-${index}`,
    tripId,
    type: punkt.type,
    title: punkt.title,
    shortText: punkt.shortText,
    longText: punkt.longText,
    startAt: punkt.startAt,
    endAt: punkt.endAt,
    position: punkt.position,
    poiId: punkt.poiId ?? undefined,
  }));
}
