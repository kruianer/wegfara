import type { Activity, ActivityPosition } from "@/lib/activities/types";
import type { Poi, PoiType } from "@/lib/pois/types";
import type { TempoRegeln } from "@/lib/trips/tempo";
import { poiDurationMinutes } from "@/lib/pois/estimated-duration";
import { FUSS_MAX_KM, luftlinieKm } from "@/lib/transfers/vorschlag";
import { dayTimeAt } from "./plan-poi";

/**
 * Die Rechenarbeit hinter "KI planen lassen" (req-056): POIs auf die
 * Reisetage verteilen und einen Tag in eine Abfolge von Programmpunkten
 * bringen.
 *
 * Hier steht nur, was sich ausrechnen laesst -- die KI selbst und die echten
 * Fahrzeiten liegen in ki-planung.ts hinter ihren Schnittstellen. Alles hier
 * ist rein: dieselben Eingaben ergeben denselben Plan, und derselbe Plan
 * laesst sich ohne Netz pruefen.
 */

/** Der Tag beginnt um 08:00 (req-056, Funktion). */
export const TAGESBEGINN_MINUTEN = 8 * 60;

/** Das Mittagsfenster, in dem ein Restaurant liegt (req-056). */
export const MITTAG_VON_MINUTEN = 12 * 60;
export const MITTAG_BIS_MINUTEN = 14 * 60;

/**
 * So lange bleibt mittags frei, wenn es kein Restaurant gibt (req-056). Ein
 * leerer Programmpunkt "Mittagspause" entsteht dabei ausdruecklich nicht --
 * es bleibt eine Luecke im Zeitstrahl.
 */
export const MITTAGSPAUSE_MINUTEN = 60;

/** Alles rastet auf 15 Minuten ein (req-056, Constraints; siehe req-039). */
const RASTER_MINUTEN = 15;

/** Zu Fuss gerechnet wird bis zur Grenze aus req-052, darueber mit dem Auto. */
const FUSS_KMH = 4.5;
const AUTO_KMH = 50;

/**
 * Was eine Fahrt kostet, bevor sie losgeht: zum Wagen, parken, hinlaufen.
 * Sie entspricht dem Fussweg an der Grenze -- sonst waere ein Ort zwei
 * Kilometer entfernt schneller erreicht als einer einen Kilometer entfernt,
 * und die Reihenfolge der kuerzesten Wege stuende auf dem Kopf.
 */
const AUTO_GRUNDZEIT_MINUTEN = (FUSS_MAX_KM / FUSS_KMH) * 60;

/**
 * Strassen sind laenger als die Luftlinie -- ein grober Zuschlag fuer die
 * Schaetzung. Die genaue Zahl holt die zweite Stufe beim Routing-Dienst
 * (req-056, "Wege in zwei Stufen").
 */
const UMWEG_FAKTOR = 1.3;

/**
 * Wie lange der Weg zwischen zwei Stellen dauert, in Minuten. Sie ist
 * austauschbar, weil dieselbe Rechnung einmal mit geschaetzten und einmal mit
 * gemessenen Fahrzeiten laeuft (req-056, "Wege in zwei Stufen").
 */
export type Fahrzeitschaetzung = (
  von: ActivityPosition,
  nach: ActivityPosition,
) => number;

/** Eine belegte Spanne des Reisetages, in Minuten seit dessen Mitternacht. */
export interface Belegung {
  von: number;
  bis: number;
}

/** Ein Programmpunkt des Vorschlags, wie ihn die Verteilung ausrechnet. */
export interface GeplanterPunkt {
  poi: Poi;
  /** ISO-Datum+Zeit ohne Zeitzone (YYYY-MM-DDTHH:mm), lokale Reisezeit. */
  startAt: string;
  endAt: string;
}

/** Auf das Raster aufgerundet -- eine krumme Dauer gibt es im Plan nicht. */
export function aufRaster(minuten: number): number {
  return Math.ceil(minuten / RASTER_MINUTEN) * RASTER_MINUTEN;
}

/**
 * Die Dauer des Programmpunkts zu einem POI (req-056, Constraints): die am
 * POI hinterlegte (req-058), sonst die geschaetzte seines Typs (req-011).
 */
export function poiDauerMinuten(
  poi: Pick<Poi, "type" | "durationMinutes">,
): number {
  return aufRaster(poiDurationMinutes(poi));
}

/**
 * Die geschaetzte Fahrzeit zwischen zwei Stellen (req-056, erste Stufe):
 * Luftlinie, zu Fuss oder mit dem Auto, mit grobem Umwegzuschlag.
 */
export function geschaetzteFahrzeitMinuten(
  von: ActivityPosition,
  nach: ActivityPosition,
): number {
  const km = luftlinieKm(von, nach);
  if (km <= FUSS_MAX_KM) return (km / FUSS_KMH) * 60;
  return AUTO_GRUNDZEIT_MINUTEN + ((km * UMWEG_FAKTOR) / AUTO_KMH) * 60;
}

/**
 * Ob ein Typ auf die Hoechstzahl gleichartiger POIs eines Tages zaehlt
 * (req-056): Restaurant und Hotel tun das nicht -- sie gehoeren zum
 * Tagesablauf.
 */
export function zaehltFuerTempo(type: PoiType): boolean {
  return type !== "restaurant" && type !== "hotel";
}

/** Minuten seit Mitternacht des Reisetages -- ein Ende nach Mitternacht zaehlt weiter. */
function minutenAmTag(dateTime: string, date: string): number {
  const [stunden, minuten] = dateTime.slice(11, 16).split(":").map(Number);
  return (
    stunden * 60 + minuten + (dateTime.slice(0, 10) === date ? 0 : 24 * 60)
  );
}

/**
 * Die Spannen, die bestehende Programmpunkte an einem Reisetag belegen --
 * ohne das Haekchen "Bestehendes neu ordnen" bleiben sie unangetastet, und
 * die KI fuellt nur die Luecken (req-056).
 */
export function belegungenAmTag(
  activities: Activity[],
  date: string,
): Belegung[] {
  return activities
    .filter((activity) => activity.startAt.slice(0, 10) === date)
    .map((activity) => ({
      von: minutenAmTag(activity.startAt, date),
      bis: minutenAmTag(activity.endAt, date),
    }));
}

/** Der fruehste Beginn ab dieser Zeit, der in keine belegte Spanne faellt. */
function naechsteFreieZeit(
  fruehestens: number,
  dauer: number,
  belegt: Belegung[],
): number {
  let beginn = fruehestens;
  let verschoben = true;
  while (verschoben) {
    verschoben = false;
    for (const block of belegt) {
      if (beginn < block.bis && block.von < beginn + dauer) {
        beginn = aufRaster(block.bis);
        verschoben = true;
      }
    }
  }
  return beginn;
}

/**
 * Die Reihenfolge, die die kuerzesten Wege ergibt (req-056): vom Ausgangsort
 * aus immer zum naechstgelegenen noch offenen POI. Bei gleichem Weg gilt die
 * Reihenfolge der Uebergabe -- derselbe Tag ergibt denselben Plan.
 */
export function kuerzesteReihenfolge(
  pois: Poi[],
  start: ActivityPosition,
  fahrzeit: Fahrzeitschaetzung,
): Poi[] {
  const offen = [...pois];
  const reihenfolge: Poi[] = [];
  let ort = start;

  while (offen.length > 0) {
    let besterIndex = 0;
    let besterWeg = Infinity;
    offen.forEach((poi, index) => {
      const weg = fahrzeit(ort, poi.position);
      if (weg < besterWeg) {
        besterWeg = weg;
        besterIndex = index;
      }
    });
    const naechster = offen.splice(besterIndex, 1)[0];
    reihenfolge.push(naechster);
    ort = naechster.position;
  }

  return reihenfolge;
}

export interface TagesplanEingabe {
  /** Die POIs, die dieser Tag aufnehmen soll. */
  pois: Poi[];
  /** ISO-Datum des Reisetages. */
  date: string;
  regeln: TempoRegeln;
  /** Spannen, die bestehende Programmpunkte belegen. */
  belegt: Belegung[];
  fahrzeit: Fahrzeitschaetzung;
  /** Von wo aus der Tag losgeht -- der Hauptort der Reise. */
  start: ActivityPosition;
}

export interface Tagesplan {
  punkte: GeplanterPunkt[];
  /** Was an diesem Tag keinen Platz mehr fand. */
  nichtGeplant: Poi[];
}

/**
 * Die Abfolge eines Reisetages (req-056): Beginn um 08:00, hoechstens so
 * lang, wie das Reisetempo erlaubt, in der Reihenfolge der kuerzesten Wege.
 * Zwischen zwei Programmpunkten bleibt die geschaetzte Fahrzeit frei -- dort
 * liegt spaeter der Transfer (req-052).
 *
 * Mittags liegt das Restaurant des Tages; gibt es keines, bleibt dort eine
 * Stunde frei, ohne dass ein leerer Programmpunkt entsteht.
 */
export function planeTag(eingabe: TagesplanEingabe): Tagesplan {
  const { date, regeln, belegt, fahrzeit, start } = eingabe;
  const tagesende = TAGESBEGINN_MINUTEN + regeln.tageslaengeStunden * 60;
  const restaurant = eingabe.pois.find((poi) => poi.type === "restaurant");
  const uebrige = eingabe.pois.filter((poi) => poi !== restaurant);
  const reihenfolge = kuerzesteReihenfolge(uebrige, start, fahrzeit);

  const punkte: GeplanterPunkt[] = [];
  const nichtGeplant: Poi[] = [];
  let zeit = TAGESBEGINN_MINUTEN;
  let ort: ActivityPosition | null = null;
  let mittagErledigt = false;

  /** Wann der POI fruehestens drankommt: nach dem Weg vom vorigen Ort. */
  function fruehesterBeginn(poi: Poi): number {
    return ort === null ? zeit : zeit + aufRaster(fahrzeit(ort, poi.position));
  }

  /** Setzt den POI, wenn er noch in den Tag passt; sonst bleibt er ungeplant. */
  function plane(poi: Poi, fruehestens: number): boolean {
    const dauer = poiDauerMinuten(poi);
    const beginn = naechsteFreieZeit(fruehestens, dauer, belegt);
    if (beginn + dauer > tagesende) return false;

    punkte.push({
      poi,
      startAt: dayTimeAt(date, beginn),
      endAt: dayTimeAt(date, beginn + dauer),
    });
    zeit = beginn + dauer;
    ort = poi.position;
    return true;
  }

  /** Das Mittagsfenster: das Restaurant hinein, sonst eine Stunde frei. */
  function mittag() {
    mittagErledigt = true;
    if (!restaurant) {
      zeit = Math.max(zeit, MITTAG_VON_MINUTEN + MITTAGSPAUSE_MINUTEN);
      return;
    }

    // Zwischen 12:00 und 14:00 (req-056): spaeter als 14:00 beginnt es nicht,
    // frueher als 12:00 auch nicht -- der Weg dorthin kann es nach hinten
    // schieben, das Fenster verlaesst es dabei nicht.
    const spaetester = Math.max(
      MITTAG_VON_MINUTEN,
      MITTAG_BIS_MINUTEN - poiDauerMinuten(restaurant),
    );
    const fruehestens = Math.min(
      Math.max(fruehesterBeginn(restaurant), MITTAG_VON_MINUTEN),
      spaetester,
    );
    if (!plane(restaurant, fruehestens)) {
      nichtGeplant.push(restaurant);
      zeit = Math.max(zeit, MITTAG_VON_MINUTEN + MITTAGSPAUSE_MINUTEN);
    }
  }

  for (const poi of reihenfolge) {
    // Reicht der naechste Programmpunkt ins Mittagsfenster, kommt das
    // Mittagessen zuerst -- danach geht es weiter.
    if (!mittagErledigt) {
      const dauer = poiDauerMinuten(poi);
      const beginn = naechsteFreieZeit(fruehesterBeginn(poi), dauer, belegt);
      if (beginn + dauer > MITTAG_VON_MINUTEN) mittag();
    }
    if (!plane(poi, fruehesterBeginn(poi))) nichtGeplant.push(poi);
  }

  // Ein Tag, der vor dem Mittag endet, bekommt sein Restaurant trotzdem.
  if (!mittagErledigt) mittag();

  return { punkte, nichtGeplant };
}

export interface VerteilungsEingabe {
  /** Die zu verplanenden POIs, die wichtigsten zuerst ("Gesetzt" vor "Wahrscheinlich"). */
  pois: Poi[];
  /** Die Reisetage als ISO-Datum, in ihrer Reihenfolge. */
  tage: string[];
  regeln: TempoRegeln;
  /** Die bestehenden Programmpunkte, die stehen bleiben. */
  feste: Activity[];
  fahrzeit: Fahrzeitschaetzung;
  start: ActivityPosition;
  /** Was die KI vorgeschlagen hat: POI-Kennung auf Tagesnummer (ab 0). */
  hinweis: Map<string, number>;
}

export interface Verteilung {
  punkte: GeplanterPunkt[];
  /** POIs, die in keinen Reisetag mehr passten (req-056). */
  ohnePlatz: Poi[];
}

/**
 * Die POIs eines Tages: erst, was die KI ihm zugedacht hat, dann die
 * naechstgelegenen (Luftlinie). Die Hoechstzahl gleichartiger Typen und das
 * eine Mittagsfenster gelten dabei immer -- ein Vorschlag der KI hebt sie
 * nicht auf.
 */
function waehleTagesPois(
  offen: Poi[],
  tagIndex: number,
  hoechstens: number,
  eingabe: VerteilungsEingabe,
  letzterTag: boolean,
): Poi[] {
  const gewaehlt: Poi[] = [];
  const jeTyp = new Map<PoiType, number>();

  function passt(poi: Poi): boolean {
    // Restaurant und Hotel gehoeren zum Tagesablauf (req-056) -- sie zaehlen
    // weder auf die Hoechstzahl gleicher Typen noch auf die Tagesmenge. Vom
    // einen wie vom anderen nimmt ein Tag genau eines auf: es gibt ein
    // Mittagsfenster und eine Unterkunft.
    if (!zaehltFuerTempo(poi.type)) {
      return !gewaehlt.some((gewaehlter) => gewaehlter.type === poi.type);
    }
    const zaehlende = gewaehlt.filter((gewaehlter) =>
      zaehltFuerTempo(gewaehlter.type),
    ).length;
    if (zaehlende >= hoechstens) return false;
    return (jeTyp.get(poi.type) ?? 0) < eingabe.regeln.maxGleicheTypen;
  }

  function nimm(poi: Poi) {
    gewaehlt.push(poi);
    jeTyp.set(poi.type, (jeTyp.get(poi.type) ?? 0) + 1);
  }

  for (const poi of offen) {
    if (eingabe.hinweis.get(poi.id) === tagIndex && passt(poi)) nimm(poi);
  }

  // Aufgefuellt wird mit dem, was am naechsten dabeiliegt (req-056: was nah
  // beieinanderliegt, kommt auf denselben Tag). Was die KI einem spaeteren Tag
  // zugedacht hat, bleibt ihm -- nur am letzten Reisetag zaehlt das nicht
  // mehr, sonst bliebe es ungeplant.
  for (const spaetereZugedachte of [false, true]) {
    if (spaetereZugedachte && !letzterTag) break;
    // Gefuellt wird, bis kein zulaessiger Kandidat mehr da ist -- die
    // Hoechstzahlen stecken in `passt`.
    for (;;) {
      const kandidat = naechsterKandidat(offen, gewaehlt, tagIndex, {
        passt,
        spaetereZugedachte,
        eingabe,
      });
      if (!kandidat) break;
      nimm(kandidat);
    }
  }

  return gewaehlt;
}

/** Der naechstgelegene noch offene POI, der an diesem Tag zulaessig ist. */
function naechsterKandidat(
  offen: Poi[],
  gewaehlt: Poi[],
  tagIndex: number,
  regeln: {
    passt: (poi: Poi) => boolean;
    /** Ob auch POIs zaehlen, die die KI einem spaeteren Tag zugedacht hat. */
    spaetereZugedachte: boolean;
    eingabe: VerteilungsEingabe;
  },
): Poi | null {
  let bester: Poi | null = null;
  let besteEntfernung = Infinity;

  for (const poi of offen) {
    if (gewaehlt.includes(poi) || !regeln.passt(poi)) continue;
    const zugedacht = regeln.eingabe.hinweis.get(poi.id);
    if (
      !regeln.spaetereZugedachte &&
      zugedacht !== undefined &&
      zugedacht > tagIndex
    ) {
      continue;
    }

    // Ohne einen ersten POI gibt es keine Entfernung -- dann zaehlt die
    // Wichtigkeit: "Gesetzt" steht vorn in der Liste.
    if (gewaehlt.length === 0) return poi;

    const entfernung = Math.min(
      ...gewaehlt.map((gewaehlter) =>
        luftlinieKm(gewaehlter.position, poi.position),
      ),
    );
    if (entfernung < besteEntfernung) {
      besteEntfernung = entfernung;
      bester = poi;
    }
  }

  return bester;
}

/**
 * Verteilt die POIs auf die Reisetage (req-056). Jeder Tag bekommt hoechstens
 * so viele, dass fuer die folgenden noch etwas bleibt -- sechs POIs auf drei
 * Tagen ergeben nicht einen vollen Tag und zwei leere. Was ein Tag nicht mehr
 * aufnehmen konnte, wird beim naechsten versucht; was in keinen mehr passt,
 * bleibt in "Noch unverplant".
 */
export function verteilePois(eingabe: VerteilungsEingabe): Verteilung {
  const offen = [...eingabe.pois];
  const punkte: GeplanterPunkt[] = [];

  eingabe.tage.forEach((date, index) => {
    if (offen.length === 0) return;

    // Restaurant und Hotel zaehlen nicht mit: sonst bekaeme ein Reisetag ein
    // Mittagessen statt einer Sehenswuerdigkeit (req-056).
    const zaehlende = offen.filter((poi) => zaehltFuerTempo(poi.type)).length;
    const hoechstens = Math.max(
      1,
      Math.ceil(zaehlende / (eingabe.tage.length - index)),
    );
    const gewaehlt = waehleTagesPois(
      offen,
      index,
      hoechstens,
      eingabe,
      index === eingabe.tage.length - 1,
    );
    const plan = planeTag({
      pois: gewaehlt,
      date,
      regeln: eingabe.regeln,
      belegt: belegungenAmTag(eingabe.feste, date),
      fahrzeit: eingabe.fahrzeit,
      start: eingabe.start,
    });

    punkte.push(...plan.punkte);
    const verplant = new Set(plan.punkte.map((punkt) => punkt.poi.id));
    for (const poi of gewaehlt) {
      if (!verplant.has(poi.id)) continue;
      offen.splice(offen.indexOf(poi), 1);
    }
  });

  return { punkte, ohnePlatz: offen };
}

/**
 * Die aufeinanderfolgenden Paare eines Tages -- zwischen ihnen liegt der Weg,
 * dessen echte Fahrzeit die zweite Stufe holt (req-056).
 */
export function tagesPaare(
  punkte: GeplanterPunkt[],
): [GeplanterPunkt, GeplanterPunkt][] {
  const jeTag = new Map<string, GeplanterPunkt[]>();
  for (const punkt of punkte) {
    const date = punkt.startAt.slice(0, 10);
    jeTag.set(date, [...(jeTag.get(date) ?? []), punkt]);
  }

  const paare: [GeplanterPunkt, GeplanterPunkt][] = [];
  for (const tagesPunkte of jeTag.values()) {
    const sortiert = [...tagesPunkte].sort((a, b) =>
      a.startAt.localeCompare(b.startAt),
    );
    for (let index = 0; index + 1 < sortiert.length; index += 1) {
      paare.push([sortiert[index], sortiert[index + 1]]);
    }
  }
  return paare;
}

/** Die Luecke zwischen zwei aufeinanderfolgenden Programmpunkten, in Minuten. */
export function lueckeMinutenZwischen(
  von: GeplanterPunkt,
  nach: GeplanterPunkt,
): number {
  const date = von.startAt.slice(0, 10);
  return minutenAmTag(nach.startAt, date) - minutenAmTag(von.endAt, date);
}
