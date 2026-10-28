import type { Activity, ActivityPosition } from "../activities/types";
import type { Transfer, TransferMode } from "../transfers/types";
import { tagesfarbe } from "./tagesfarben";
import type {
  DruckKachel,
  DruckKarte,
  DruckKartenLinie,
  DruckKartenNadel,
  DruckStrich,
  DruckTag,
} from "./types";

/**
 * Die Karten des gedruckten Reiseplans (req-103): die Uebersichtskarte auf
 * Seite 2 und die flache Tageskarte oben auf jeder Tagesseite.
 *
 * Sie entstehen hier als fertige Zeichnung -- Kacheln, Linien und Nadeln mit
 * ihren Koordinaten in einer festen Flaeche --, nicht als lebendige Karte
 * wie im Planer: eine MapLibre-Karte laesst sich nicht verlaesslich drucken,
 * und das Heft soll an jeder Stelle gleich aussehen. Gezeichnet wird das
 * Ergebnis als SVG (app/plan/reiseplan/druck-karte.tsx).
 *
 * Die Kacheln sind **hell** -- die dunklen des Planers sind auf Papier
 * unbrauchbar (req-080). Faellt ihre Quelle aus, bleibt die Karte leer mit
 * Linien und Nadeln darauf; der Plan bleibt druckbar.
 */

/**
 * Die Quelle der hellen Kartenkacheln -- an genau einer Stelle. Kacheln in
 * doppelter Aufloesung (`@2x`), damit sie auf Papier nicht verschwimmen.
 */
export const DRUCK_KACHEL_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png";

/** Was unter jeder Karte als Herkunft stehen muss. */
export const DRUCK_KARTEN_NACHWEIS = "© OpenStreetMap-Mitwirkende · © CARTO";

/** Die Kantenlaenge einer Kachel in den Einheiten der Zeichnung. */
const KACHEL = 256;

/** Die Flaeche der Uebersichtskarte -- rund 180 × 98 mm auf A4. */
export const UEBERSICHT_FLAECHE = { breite: 680, hoehe: 370 } as const;

/**
 * Die Flaeche der Tageskarte -- flach ueber die Breite, etwa ein Fuenftel der
 * Seite. Mehr wuerde den Stationen den Platz nehmen.
 */
export const TAGESKARTE_FLAECHE = { breite: 680, hoehe: 200 } as const;

interface Punkt {
  x: number;
  y: number;
}

/** Die Lage eines Ortes in der Welt bei dieser Zoomstufe (Web-Mercator). */
function weltpunkt(position: ActivityPosition, zoom: number): Punkt {
  const umfang = KACHEL * 2 ** zoom;
  const sinus = Math.sin((position.lat * Math.PI) / 180);
  return {
    x: ((position.lng + 180) / 360) * umfang,
    y: (0.5 - Math.log((1 + sinus) / (1 - sinus)) / (4 * Math.PI)) * umfang,
  };
}

/** Der Ausschnitt einer Karte: Zoomstufe und die linke obere Ecke. */
export interface Ausschnitt {
  zoom: number;
  links: number;
  oben: number;
  breite: number;
  hoehe: number;
}

/**
 * Der Ausschnitt, der diese Orte mit etwas Rand umfasst -- bei der groessten
 * Zoomstufe, bei der sie noch hineinpassen.
 */
export function ausschnitt(
  positionen: ActivityPosition[],
  flaeche: { breite: number; hoehe: number },
  { maxZoom = 15, rand = 36 }: { maxZoom?: number; rand?: number } = {},
): Ausschnitt | null {
  if (positionen.length === 0) return null;

  let zoom = Math.min(maxZoom, 13);
  if (positionen.length > 1) {
    zoom = 1;
    for (let stufe = maxZoom; stufe >= 1; stufe--) {
      const punkte = positionen.map((p) => weltpunkt(p, stufe));
      const xs = punkte.map((p) => p.x);
      const ys = punkte.map((p) => p.y);
      const breite = Math.max(...xs) - Math.min(...xs);
      const hoehe = Math.max(...ys) - Math.min(...ys);
      if (
        breite <= flaeche.breite - 2 * rand &&
        hoehe <= flaeche.hoehe - 2 * rand
      ) {
        zoom = stufe;
        break;
      }
    }
  }

  const punkte = positionen.map((p) => weltpunkt(p, zoom));
  const xs = punkte.map((p) => p.x);
  const ys = punkte.map((p) => p.y);
  const mitteX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const mitteY = (Math.max(...ys) + Math.min(...ys)) / 2;
  return {
    zoom,
    links: mitteX - flaeche.breite / 2,
    oben: mitteY - flaeche.hoehe / 2,
    breite: flaeche.breite,
    hoehe: flaeche.hoehe,
  };
}

/** Wo ein Ort in der Zeichnung liegt -- auch ausserhalb der Flaeche. */
export function projiziere(
  position: ActivityPosition,
  rahmen: Ausschnitt,
): Punkt {
  const welt = weltpunkt(position, rahmen.zoom);
  return {
    x: Math.round((welt.x - rahmen.links) * 10) / 10,
    y: Math.round((welt.y - rahmen.oben) * 10) / 10,
  };
}

/** Ob ein Punkt der Zeichnung innerhalb ihrer Flaeche liegt. */
export function imAusschnitt(punkt: Punkt, rahmen: Ausschnitt): boolean {
  return (
    punkt.x >= 0 &&
    punkt.x <= rahmen.breite &&
    punkt.y >= 0 &&
    punkt.y <= rahmen.hoehe
  );
}

/** Die Kacheln, die den Ausschnitt bedecken. */
export function kacheln(rahmen: Ausschnitt): DruckKachel[] {
  const anzahl = 2 ** rahmen.zoom;
  const ergebnis: DruckKachel[] = [];
  const vonX = Math.floor(rahmen.links / KACHEL);
  const bisX = Math.floor((rahmen.links + rahmen.breite) / KACHEL);
  const vonY = Math.max(0, Math.floor(rahmen.oben / KACHEL));
  const bisY = Math.min(
    anzahl - 1,
    Math.floor((rahmen.oben + rahmen.hoehe) / KACHEL),
  );
  for (let y = vonY; y <= bisY; y++) {
    for (let x = vonX; x <= bisX; x++) {
      const kachelX = ((x % anzahl) + anzahl) % anzahl;
      ergebnis.push({
        url: DRUCK_KACHEL_URL.replace("{s}", "abcd"[(kachelX + y) % 4])
          .replace("{z}", String(rahmen.zoom))
          .replace("{x}", String(kachelX))
          .replace("{y}", String(y)),
        x: Math.round((x * KACHEL - rahmen.links) * 10) / 10,
        y: Math.round((y * KACHEL - rahmen.oben) * 10) / 10,
        groesse: KACHEL,
      });
    }
  }
  return ergebnis;
}

/** Die Entfernung zweier Orte in Kilometern (Grosskreis). */
function entfernungKm(a: ActivityPosition, b: ActivityPosition): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function median(werte: number[]): number {
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 === 1
    ? sortiert[mitte]
    : (sortiert[mitte - 1] + sortiert[mitte]) / 2;
}

/** Ab dieser Entfernung vom Kern der Reise kann ein Ort weit weg liegen. */
const MINDESTENS_WEIT_KM = 30;
/** ... und wenn er so viel weiter weg liegt als die Orte im Mittel. */
const FAKTOR_WEIT = 4;

/**
 * Welche Stationen "vor Ort" liegen (req-103, req-018): der Ausschnitt
 * richtet sich nach ihnen. Was weit abseits liegt -- der Wohnort, von dem die
 * Anreise ausgeht, der Abflughafen --, liegt ausserhalb, und die Linie dorthin
 * laeuft am Rand aus dem Bild.
 *
 * Entschieden wird allein ueber die Lage, **nicht ueber das
 * Verkehrsmittel**: 800 km mit dem Auto sind dieselbe Anreise wie ein Flug.
 * Ein Ort gilt als weit weg, wenn er mehr als viermal so weit vom Kern der
 * Reise entfernt liegt wie ihre Orte im Mittel (Median) -- und mindestens
 * 30 km. Der Kern ist der Median der Orte, nicht ihr Durchschnitt: so zieht
 * ein einzelner ferner Ort ihn nicht zu sich.
 */
export function vorOrt<T extends { position: ActivityPosition }>(
  orte: T[],
): T[] {
  if (orte.length <= 2) return orte;
  const kern = {
    lat: median(orte.map((o) => o.position.lat)),
    lng: median(orte.map((o) => o.position.lng)),
  };
  const entfernungen = orte.map((o) => entfernungKm(kern, o.position));
  const grenze = Math.max(
    MINDESTENS_WEIT_KM,
    FAKTOR_WEIT * median(entfernungen),
  );
  return orte.filter((_, index) => entfernungen[index] <= grenze);
}

/**
 * Die Strichart einer Linie auf der Tageskarte (req-103). Die Farbe gehoert
 * dem Tag, die Strichart dem Verkehrsmittel -- drei Arten statt acht Mittel:
 * gepunktet zu Fuss und mit dem Rad, kurz gestrichelt mit Bus, Bahn, Faehre,
 * Boot (und Flug, wie in req-018), durchgezogen mit dem Auto.
 */
export function strichart(mode: TransferMode): DruckStrich {
  if (mode === "fuss" || mode === "rad") return "gepunktet";
  if (mode === "auto") return "durchgezogen";
  return "kurzGestrichelt";
}

/** Die drei Arten der Tageskarte, wie die Legende sie nennt. */
export const STRICHARTEN_LEGENDE: { strich: DruckStrich; label: string }[] = [
  { strich: "gepunktet", label: "zu Fuß · Rad" },
  { strich: "kurzGestrichelt", label: "Bus · Bahn · Schiff" },
  { strich: "durchgezogen", label: "Auto" },
];

/** Eine Station mit Ort, wie die Karten sie brauchen. */
interface KartenStation {
  activityId: string;
  name: string;
  tag: number;
  /** Die Stelle im Tag, ab 1. */
  reihenfolge: number;
  position: ActivityPosition;
}

function kartenStationen(tage: DruckTag[]): KartenStation[] {
  return tage.flatMap((tag) =>
    tag.stationen.flatMap((station, index) =>
      station.position
        ? [
            {
              activityId: station.activityId,
              name: station.name,
              tag: tag.nummer,
              reihenfolge: index + 1,
              position: station.position,
            },
          ]
        : [],
    ),
  );
}

/** Ein Transfer, wie die Karten ihn brauchen: mit Tag und beiden Orten. */
interface KartenWeg {
  id: string;
  tag: number;
  mode: TransferMode;
  von: ActivityPosition;
  nach: ActivityPosition;
}

function kartenWege(
  tage: DruckTag[],
  activities: Activity[],
  transfers: Transfer[],
): KartenWeg[] {
  const tagJeDatum = new Map(tage.map((tag) => [tag.datum, tag.nummer]));
  const activityById = new Map(activities.map((a) => [a.id, a]));
  return transfers.flatMap((transfer) => {
    const von = activityById.get(transfer.fromActivityId);
    const nach = activityById.get(transfer.toActivityId);
    if (!von?.position || !nach?.position) return [];
    const tag = tagJeDatum.get(von.startAt.slice(0, 10));
    if (tag === undefined) return [];
    return [
      {
        id: transfer.id,
        tag,
        mode: transfer.mode,
        von: von.position,
        nach: nach.position,
      },
    ];
  });
}

/**
 * Die Uebersichtskarte (req-103): die ganze Reise, die Transfers je Tag in
 * seiner Farbe. Was im Ausschnitt liegt, ist durchgezogen; was hinauslaeuft,
 * gestrichelt. Null, wenn keine Station einen Ort hat.
 */
export function uebersichtsKarte({
  tage,
  activities,
  transfers,
}: {
  tage: DruckTag[];
  activities: Activity[];
  transfers: Transfer[];
}): DruckKarte | null {
  const stationen = kartenStationen(tage);
  const rahmen = ausschnitt(
    vorOrt(stationen).map((s) => s.position),
    UEBERSICHT_FLAECHE,
  );
  if (!rahmen) return null;

  const linien: DruckKartenLinie[] = kartenWege(
    tage,
    activities,
    transfers,
  ).map((weg) => {
    const von = projiziere(weg.von, rahmen);
    const nach = projiziere(weg.nach, rahmen);
    const drin = imAusschnitt(von, rahmen) && imAusschnitt(nach, rahmen);
    return {
      id: weg.id,
      tag: weg.tag,
      farbe: tagesfarbe(weg.tag),
      strich: drin ? "durchgezogen" : "gestrichelt",
      x1: von.x,
      y1: von.y,
      x2: nach.x,
      y2: nach.y,
    };
  });

  // Eine Nadel je Station, klein und ohne Nummer: die Zuordnung leistet die
  // Farbe, und bei vielen Stationen waeren Nummern unlesbar.
  const nadeln: DruckKartenNadel[] = stationen.map((station) => ({
    id: station.activityId,
    titel: station.name,
    farbe: tagesfarbe(station.tag),
    nummer: null,
    ...projiziere(station.position, rahmen),
  }));

  return {
    breite: rahmen.breite,
    hoehe: rahmen.hoehe,
    kacheln: kacheln(rahmen),
    linien,
    nadeln,
  };
}

/**
 * Die Tageskarte (req-103): nur dieser Tag, in seiner Farbe -- keine anderen
 * Tage, keine graue Umgebung. Die Nummern sind die Reihenfolge des Tages,
 * nicht die POI-Nummern; das Verkehrsmittel steckt in der Strichart.
 *
 * Der Ausschnitt folgt derselben Regel wie die Uebersicht: er umfasst die
 * Stationen des Tages, die vor Ort liegen -- gemessen an der ganzen Reise.
 * Liegt der ganze Tag abseits, umfasst er eben ihn. Null, wenn keine Station
 * des Tages einen Ort hat.
 */
export function tagesKarte({
  tag,
  tage,
  activities,
  transfers,
}: {
  tag: DruckTag;
  /** Alle Tage der Reise -- an ihnen misst sich, was vor Ort liegt. */
  tage: DruckTag[];
  activities: Activity[];
  transfers: Transfer[];
}): DruckKarte | null {
  const alle = kartenStationen(tage);
  const vorOrtIds = new Set(vorOrt(alle).map((s) => s.activityId));
  const desTages = alle.filter((s) => s.tag === tag.nummer);
  const fuerAusschnitt = desTages.filter((s) => vorOrtIds.has(s.activityId));
  const rahmen = ausschnitt(
    (fuerAusschnitt.length > 0 ? fuerAusschnitt : desTages).map(
      (s) => s.position,
    ),
    TAGESKARTE_FLAECHE,
    { maxZoom: 16, rand: 30 },
  );
  if (!rahmen) return null;

  const farbe = tagesfarbe(tag.nummer);
  const linien: DruckKartenLinie[] = kartenWege(tage, activities, transfers)
    .filter((weg) => weg.tag === tag.nummer)
    .map((weg) => {
      const von = projiziere(weg.von, rahmen);
      const nach = projiziere(weg.nach, rahmen);
      return {
        id: weg.id,
        tag: weg.tag,
        farbe,
        strich: strichart(weg.mode),
        x1: von.x,
        y1: von.y,
        x2: nach.x,
        y2: nach.y,
      };
    });

  const nadeln: DruckKartenNadel[] = desTages.map((station) => ({
    id: station.activityId,
    titel: station.name,
    farbe,
    nummer: station.reihenfolge,
    ...projiziere(station.position, rahmen),
  }));

  return {
    breite: rahmen.breite,
    hoehe: rahmen.hoehe,
    kacheln: kacheln(rahmen),
    linien,
    nadeln,
  };
}
