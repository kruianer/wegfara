import type { Queryable } from "../db/queryable";
import {
  listTrips,
  tripBelongsToAccount,
  zaehleReiseInhalte,
} from "../db/trips";
import { TRIP_STATE_LABEL } from "../trips/state";
import { liesPlan } from "../chat/plan-leser";
import type { PlanAuskunft } from "../ai/chat-client";
import { accountApiKey } from "../api-keys/account-keys";
import {
  googlePlacesClient,
  type GoogleAbfrageFehler,
  type GooglePlacesClient,
} from "../google/places-client";
import type { Routenprofil, RoutingClient, Wegpunkt } from "../routing/client";
import type { WerkzeugName } from "./beschreibungen";
import { nimmGoogleAbfrage } from "./google-grenze";

/**
 * Fuehrt ein Werkzeug der Lese-Schnittstelle aus (req-104). Keines schreibt.
 *
 * Der Account kommt vom Aufrufer -- aus dem geprueften Schluessel, nie aus
 * den Argumenten. Jedes Werkzeug nennt einen Grund, statt leer
 * zurueckzukommen; ein Grund ist ein Ergebnis mit `fehler: true`, kein
 * Absturz.
 *
 * Was zurueckgeht, wird Feld fuer Feld zusammengestellt -- nie eine
 * Datenbankzeile im Ganzen. Die vier Reise-Werkzeuge teilen sich die
 * Leseschicht mit dem Chat (lib/chat/plan-leser.ts, req-093).
 */

export interface WerkzeugErgebnis {
  text: string;
  fehler: boolean;
}

export interface WerkzeugUmgebung {
  db: Queryable;
  now: Date;
  /** Der Zugang zu Google, gebunden an den Schluessel des Accounts. */
  google?: (
    apiKey: string,
  ) => Pick<GooglePlacesClient, "searchPlaces" | "placeDetails">;
  routing: RoutingClient;
}

/** Die Antwort, wenn eine Reise nicht zu diesem Account gehoert -- oder gar nicht existiert. */
export const NICHT_GEFUNDEN = "Reise nicht gefunden.";

export const KEIN_GOOGLE_SCHLUESSEL =
  "Für diesen Account ist kein Google-Zugangsschlüssel hinterlegt. Ohne ihn kann wegfara keine Orte nachschlagen; er wird in wegfara unter „Mein Bereich“ → „Zugangsschlüssel“ gesetzt.";

export function googleGrenzeErreicht(stand: number, grenze: number): string {
  return `Die Tagesgrenze für Google-Abfragen ist erreicht: ${stand} von ${grenze} heute. Es wurde keine Abfrage an Google geschickt; morgen geht es wieder.`;
}

const GOOGLE_FEHLER: Record<GoogleAbfrageFehler, string> = {
  zugang_abgelehnt:
    "Google hat den Zugangsschlüssel dieses Accounts abgewiesen — der Schlüssel oder seine Freigabe in der Google Cloud Console stimmt nicht.",
  abfrage_fehlgeschlagen:
    "Die Abfrage bei Google ist fehlgeschlagen. Später noch einmal versuchen.",
};

export const ROUTING_SCHWEIGT =
  "Der Routing-Dienst antwortet nicht oder kennt zwischen diesen Stellen keinen Weg — Dauer und Entfernung sind gerade nicht zu ermitteln.";

function ergebnis(inhalt: unknown): WerkzeugErgebnis {
  return { text: JSON.stringify(inhalt, null, 2), fehler: false };
}

function grund(text: string): WerkzeugErgebnis {
  return { text, fehler: true };
}

function argumente(eingabe: unknown): Record<string, unknown> {
  return typeof eingabe === "object" && eingabe !== null
    ? (eingabe as Record<string, unknown>)
    : {};
}

function text(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim().length > 0
    ? wert.trim()
    : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function reisenAuflisten(
  umgebung: WerkzeugUmgebung,
  accountId: string,
): Promise<WerkzeugErgebnis> {
  const [trips, inhalte] = await Promise.all([
    listTrips(umgebung.db, accountId),
    zaehleReiseInhalte(umgebung.db, accountId),
  ]);
  return ergebnis({
    reisen: trips.map((trip) => ({
      kennung: trip.id,
      titel: trip.title,
      von: trip.startDate,
      bis: trip.endDate,
      zustand: TRIP_STATE_LABEL[trip.state],
      pois: inhalte.get(trip.id)?.pois ?? 0,
      programmpunkte: inhalte.get(trip.id)?.programmpunkte ?? 0,
    })),
  });
}

function ausAuskunft(auskunft: PlanAuskunft): WerkzeugErgebnis {
  return auskunft.ok ? ergebnis(auskunft.inhalt) : grund(auskunft.hinweis);
}

/**
 * Die vier Werkzeuge ueber eine Reise. Ob sie zum Account gehoert, wird vor
 * dem Lesen geprueft -- eine fremde und eine nicht vorhandene sehen gleich
 * aus, damit nichts verraet, ob es sie anderswo gibt.
 */
async function ueberEineReise(
  umgebung: WerkzeugUmgebung,
  accountId: string,
  werkzeug: "reise_lesen" | "pois_lesen" | "tagesplan_lesen" | "kosten_lesen",
  args: Record<string, unknown>,
): Promise<WerkzeugErgebnis> {
  const tripId = text(args.reise);
  if (
    !tripId ||
    !UUID.test(tripId) ||
    !(await tripBelongsToAccount(umgebung.db, accountId, tripId))
  ) {
    return grund(NICHT_GEFUNDEN);
  }
  // An die Leseschicht geht nur der Reisetag -- die Reise steht schon fest.
  const eingabe = args.datum === undefined ? {} : { datum: args.datum };
  return ausAuskunft(
    await liesPlan(umgebung.db, accountId, tripId, werkzeug, eingabe),
  );
}

/**
 * Der Zugang zu Google fuer diesen Account -- oder der Grund, warum es
 * keinen gibt. Erst wenn ein Schluessel da ist, wird die Grenze geprueft
 * und gezaehlt; ist sie erreicht, geht nichts an Google.
 */
async function googleZugang(
  umgebung: WerkzeugUmgebung,
  accountId: string,
): Promise<
  | {
      ok: true;
      google: Pick<GooglePlacesClient, "searchPlaces" | "placeDetails">;
    }
  | { ok: false; ergebnis: WerkzeugErgebnis }
> {
  const apiKey = await accountApiKey(umgebung.db, accountId, "google");
  if (!apiKey) return { ok: false, ergebnis: grund(KEIN_GOOGLE_SCHLUESSEL) };

  const kontingent = await nimmGoogleAbfrage(
    umgebung.db,
    accountId,
    umgebung.now,
  );
  if (!kontingent.frei) {
    return {
      ok: false,
      ergebnis: grund(
        googleGrenzeErreicht(kontingent.stand, kontingent.grenze),
      ),
    };
  }
  return {
    ok: true,
    google: (umgebung.google ?? googlePlacesClient)(apiKey),
  };
}

async function ortSuchen(
  umgebung: WerkzeugUmgebung,
  accountId: string,
  args: Record<string, unknown>,
): Promise<WerkzeugErgebnis> {
  const suchbegriff = text(args.suchbegriff);
  if (!suchbegriff) return grund("Ohne Suchbegriff ist nichts zu suchen.");

  const zugang = await googleZugang(umgebung, accountId);
  if (!zugang.ok) return zugang.ergebnis;

  const abfrage = await zugang.google.searchPlaces(suchbegriff);
  if (!abfrage.ok) return grund(GOOGLE_FEHLER[abfrage.fehler]);
  const orte = abfrage.treffer ?? [];
  if (orte.length === 0) {
    return grund(`Zu „${suchbegriff}“ hat Google keinen Ort gefunden.`);
  }
  return ergebnis({
    orte: orte.map((ort) => ({
      kennung: ort.placeId,
      name: ort.name,
      anschrift: ort.address ?? null,
      position: { lat: ort.position.lat, lng: ort.position.lng },
    })),
  });
}

async function ortNachschlagen(
  umgebung: WerkzeugUmgebung,
  accountId: string,
  args: Record<string, unknown>,
): Promise<WerkzeugErgebnis> {
  const kennung = text(args.kennung);
  if (!kennung)
    return grund("Ohne Kennung aus ort_suchen ist nichts nachzuschlagen.");

  const zugang = await googleZugang(umgebung, accountId);
  if (!zugang.ok) return zugang.ergebnis;

  const abfrage = await zugang.google.placeDetails(kennung);
  if (!abfrage.ok) return grund(GOOGLE_FEHLER[abfrage.fehler]);
  const ort = abfrage.treffer;
  if (!ort) return grund("Google kennt zu dieser Kennung keinen Ort.");
  return ergebnis({
    name: ort.name,
    anschrift: ort.address ?? null,
    oeffnungszeiten: ort.openingHours ?? null,
    bewertung: ort.rating ?? null,
    bewertungen: ort.ratingCount ?? null,
    webseite: ort.web ?? null,
    telefon: ort.phone ?? null,
  });
}

function stelle(wert: unknown): Wegpunkt | null {
  if (typeof wert !== "object" || wert === null) return null;
  const { lat, lng } = wert as { lat?: unknown; lng?: unknown };
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const VERKEHRSMITTEL: Record<Routenprofil, string> = {
  auto: "Auto",
  rad: "Fahrrad",
  fuss: "zu Fuß",
};

async function streckeBerechnen(
  umgebung: WerkzeugUmgebung,
  args: Record<string, unknown>,
): Promise<WerkzeugErgebnis> {
  const von = stelle(args.von);
  const nach = stelle(args.nach);
  if (!von || !nach) {
    return grund(
      'Beide Stellen brauchen Breite und Länge, z.B. { "lat": 43.2687, "lng": -2.934 }.',
    );
  }

  // Die drei Profile nebeneinander, nicht nacheinander: mitdenka wartet
  // hoechstens 20 Sekunden.
  const profile = Object.keys(VERKEHRSMITTEL) as Routenprofil[];
  const strecken = await Promise.all(
    profile.map((profil) => umgebung.routing.strecke(von, nach, profil)),
  );
  if (strecken.every((strecke) => strecke === null)) {
    return grund(ROUTING_SCHWEIGT);
  }
  return ergebnis({
    strecken: profile.map((profil, index) => {
      const strecke = strecken[index];
      return {
        verkehrsmittel: VERKEHRSMITTEL[profil],
        dauerMinuten: strecke ? Math.round(strecke.dauerMinuten) : null,
        entfernungKm: strecke ? Math.round(strecke.distanzKm * 10) / 10 : null,
      };
    }),
  });
}

export async function fuehreWerkzeugAus(
  umgebung: WerkzeugUmgebung,
  accountId: string,
  werkzeug: WerkzeugName,
  eingabe: unknown,
): Promise<WerkzeugErgebnis> {
  const args = argumente(eingabe);
  switch (werkzeug) {
    case "reisen_auflisten":
      return reisenAuflisten(umgebung, accountId);
    case "reise_lesen":
    case "pois_lesen":
    case "tagesplan_lesen":
    case "kosten_lesen":
      return ueberEineReise(umgebung, accountId, werkzeug, args);
    case "ort_suchen":
      return ortSuchen(umgebung, accountId, args);
    case "ort_nachschlagen":
      return ortNachschlagen(umgebung, accountId, args);
    case "strecke_berechnen":
      return streckeBerechnen(umgebung, args);
  }
}
