import type { Fahrstrecke, Wegpunkt } from "@/lib/routing/client";
import type { TransferMode } from "./types";

/**
 * Der Vorschlag fuer einen neuen Transfer (req-052): Verkehrsmittel, Dauer
 * und Strecke, ermittelt aus der tatsaechlichen Route zwischen den beiden
 * Programmpunkten. Alles daran ist ein Vorschlag -- geaendert wird er im
 * Formular, umgeplant wird von selbst nichts (siehe vision.md).
 */

/** Bis hierher wird "zu Fuss" vorgeschlagen, darueber "Auto" (req-052). */
export const FUSS_MAX_KM = 1.5;

/** Dauer und Strecke, wie sie im Formular stehen. */
export interface Streckenangaben {
  durationMin: number;
  distanceKm: number;
}

/**
 * Der Vorschlag zu einem Programmpunkt-Paar: das vorgeschlagene
 * Verkehrsmittel und, zu jedem der sieben, seine Dauer und Strecke. Es
 * stehen alle darin, damit ein Wechsel des Verkehrsmittels im Formular ohne
 * neue Anfrage an den Routing-Dienst auskommt.
 */
export interface TransferVorschlag {
  mode: TransferMode;
  proMittel: Record<TransferMode, Streckenangaben>;
}

/**
 * Wie schnell ein Verkehrsmittel im Mittel vorankommt. "Auto" fehlt: dessen
 * Dauer kommt aus der Route selbst. Die uebrigen Werte sind grobe Annahmen
 * -- der Vorschlag soll die Groessenordnung treffen, die genaue Zahl traegt
 * der Reiseleiter ein.
 */
const GESCHWINDIGKEIT_KMH: Record<Exclude<TransferMode, "auto">, number> = {
  fuss: 4.5,
  rad: 15,
  bus: 25,
  bahn: 70,
  boot: 20,
  faehre: 25,
  flug: 600,
};

/**
 * Verkehrsmittel, fuer die die Strasse kein Massstab ist: ueber Wasser und
 * durch die Luft zaehlt die Luftlinie, nicht die gefahrene Route.
 */
const UEBER_LUFTLINIE: TransferMode[] = ["boot", "faehre", "flug"];

const ERDRADIUS_KM = 6371;

/** Die Luftlinie zwischen zwei Stellen in Kilometern (Haversine). */
export function luftlinieKm(von: Wegpunkt, nach: Wegpunkt): number {
  const bogen = (grad: number) => (grad * Math.PI) / 180;
  const dLat = bogen(nach.lat - von.lat);
  const dLng = bogen(nach.lng - von.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(bogen(von.lat)) *
      Math.cos(bogen(nach.lat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * ERDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Bis 1,5 km Strecke "zu Fuss", darueber "Auto" (req-052, Funktion). */
export function vorgeschlagenesVerkehrsmittel(
  distanceKm: number,
): TransferMode {
  return distanceKm <= FUSS_MAX_KM ? "fuss" : "auto";
}

/** Auf eine Nachkommastelle, aber nie auf 0 -- eine Strecke hat eine Laenge. */
function alsStrecke(distanceKm: number): number {
  return Math.max(0.1, Math.round(distanceKm * 10) / 10);
}

/** Volle Minuten, mindestens eine -- eine Dauer von 0 ist keine. */
function alsDauer(durationMin: number): number {
  return Math.max(1, Math.round(durationMin));
}

/**
 * Der Vorschlag aus der Route zwischen zwei Programmpunkten (req-052).
 * `strecke` ist die gefahrene Route, `luftlinie` der direkte Weg -- ueber
 * Wasser und durch die Luft gilt dieser.
 */
export function transferVorschlag(
  strecke: Fahrstrecke,
  luftlinie: number,
): TransferVorschlag {
  const proMittel = {} as Record<TransferMode, Streckenangaben>;
  const mittel: TransferMode[] = [
    "fuss",
    "rad",
    "auto",
    "bus",
    "boot",
    "flug",
    "bahn",
    "faehre",
  ];

  for (const mode of mittel) {
    const distanceKm = UEBER_LUFTLINIE.includes(mode)
      ? luftlinie
      : strecke.distanzKm;
    const durationMin =
      mode === "auto"
        ? strecke.dauerMinuten
        : (distanceKm / GESCHWINDIGKEIT_KMH[mode]) * 60;

    proMittel[mode] = {
      distanceKm: alsStrecke(distanceKm),
      durationMin: alsDauer(durationMin),
    };
  }

  return {
    mode: vorgeschlagenesVerkehrsmittel(strecke.distanzKm),
    proMittel,
  };
}
