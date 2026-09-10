import type {
  Fahrstrecke,
  Routenprofil,
  RoutingClient,
  Wegpunkt,
} from "@/lib/routing/client";
import { routenprofilFuer } from "./routenprofil";
import { TRANSFER_MODES, type TransferMode } from "./types";

/**
 * Der Vorschlag fuer einen neuen Transfer (req-052): Verkehrsmittel, Dauer
 * und Strecke, ermittelt aus der tatsaechlichen Route zwischen den beiden
 * Programmpunkten. Seit req-059 wird jedes Verkehrsmittel mit seinem eigenen
 * OSRM-Profil gerechnet -- zu Fuss zu Fuss, das Rad mit dem Rad, Auto und Bus
 * mit dem Auto. Alles daran ist ein Vorschlag -- geaendert wird er im
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
 * Die Routen je Profil, aus denen der Vorschlag entsteht (req-059). Was der
 * Dienst nicht hergibt, fehlt darin.
 */
export type Routen = Partial<Record<Routenprofil, Fahrstrecke>>;

/**
 * Der Vorschlag zu einem Programmpunkt-Paar: das vorgeschlagene
 * Verkehrsmittel und, zu jedem mit Streckenvorschlag, seine Dauer und
 * Strecke. Es stehen alle darin, damit ein Wechsel des Verkehrsmittels im
 * Formular ohne neue Anfrage an den Routing-Dienst auskommt. Verkehrsmittel
 * ohne Profil -- Boot, Flug, Bahn, Faehre -- fehlen (req-059).
 */
export interface TransferVorschlag {
  mode: TransferMode;
  proMittel: Partial<Record<TransferMode, Streckenangaben>>;
}

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
 * Die Routen aller drei Profile zwischen zwei Stellen (req-059). Sie werden
 * gemeinsam geholt, damit der Wechsel des Verkehrsmittels im Formular ohne
 * neue Anfrage auskommt; ein stummes Profil fehlt schlicht.
 */
export async function ermittleRouten(
  client: RoutingClient,
  von: Wegpunkt,
  nach: Wegpunkt,
): Promise<Routen> {
  const profile: Routenprofil[] = ["auto", "rad", "fuss"];
  const strecken = await Promise.all(
    profile.map((profil) => client.strecke(von, nach, profil)),
  );

  const routen: Routen = {};
  profile.forEach((profil, index) => {
    const strecke = strecken[index];
    if (strecke) routen[profil] = strecke;
  });
  return routen;
}

/**
 * Der Vorschlag aus den Routen zwischen zwei Programmpunkten (req-052,
 * req-059). null heisst: keines der Profile hat eine Route hergeben -- dann
 * traegt der Reiseleiter die Angaben selbst ein.
 */
export function transferVorschlag(routen: Routen): TransferVorschlag | null {
  const proMittel: Partial<Record<TransferMode, Streckenangaben>> = {};

  for (const mode of TRANSFER_MODES) {
    const profil = routenprofilFuer(mode);
    const strecke = profil ? routen[profil] : undefined;
    if (!strecke) continue;

    proMittel[mode] = {
      distanceKm: alsStrecke(strecke.distanzKm),
      durationMin: alsDauer(strecke.dauerMinuten),
    };
  }

  // Ueber das Verkehrsmittel entscheidet die Strasse: die Strecke mit dem
  // Auto. Fehlt sie, gilt die naechstbeste Route -- und schlaegt sie ein
  // Verkehrsmittel vor, zu dem keine Angaben vorliegen, das erste vorhandene.
  const mittel = Object.keys(proMittel) as TransferMode[];
  const massgeblich = routen.auto ?? routen.rad ?? routen.fuss;
  if (!massgeblich || mittel.length === 0) return null;

  const gewaehlt = vorgeschlagenesVerkehrsmittel(massgeblich.distanzKm);
  return { mode: proMittel[gewaehlt] ? gewaehlt : mittel[0], proMittel };
}
