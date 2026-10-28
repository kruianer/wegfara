import type {
  Fahrstrecke,
  Routenprofil,
  RoutingClient,
  Wegabschnitt,
  Wegpunkt,
} from "./client";
import { envWert } from "@/lib/env/umgebung";

/**
 * OSRM auf OpenStreetMap-Daten -- Open Source, ohne Zugangsschluessel
 * (req-051, Constraints). An Google gehen dabei keine Positionen.
 *
 * Die Adresse steht an genau dieser Stelle und ist ueber OSRM_BASE_URL
 * uebersteuerbar: laeuft OSRM spaeter selbst auf dem Beelink, genuegt die
 * Umgebungsvariable, ohne dass sich am Quelltext etwas aendert.
 *
 * Eine OSRM-Instanz rechnet immer nur mit dem Profil, mit dem ihre Daten
 * aufbereitet wurden -- das Profil im Pfad waehlt keines aus. Fuer die drei
 * Profile (req-059) gibt es daher je eine oeffentliche Adresse; wer
 * OSRM_BASE_URL setzt, richtet damit alle drei auf seine eigene Instanz.
 */
const DEFAULT_BASE_URL: Record<Routenprofil, string> = {
  auto: "https://routing.openstreetmap.de/routed-car",
  rad: "https://routing.openstreetmap.de/routed-bike",
  fuss: "https://routing.openstreetmap.de/routed-foot",
};

/** Wie die drei Profile im Pfad der OSRM-Schnittstelle heissen. */
const OSRM_PROFIL: Record<Routenprofil, string> = {
  auto: "driving",
  rad: "bike",
  fuss: "foot",
};

/**
 * Wie lange ein einzelner Abruf dauern darf (bug-067). Ein Dienst, der die
 * Verbindung annimmt und dann schweigt, haelt sonst jede Anfrage fest -- im
 * Live-Status jede Minute aufs Neue.
 */
export const OSRM_ZEITGRENZE_MS = 5_000;

/**
 * Die Pausen vor dem zweiten und dritten Versuch (bug-067), wachsend. Ein
 * einzelner abgewiesener Verbindungsversuch soll nicht wie ein Ausfall
 * wirken; ein Dienst, der ueber Stunden fehlt, wird damit aber auch nicht
 * laenger als einige Sekunden je Anfrage bedraengt.
 */
export const OSRM_WARTEZEITEN_MS: readonly number[] = [300, 900];

export interface OsrmOptions {
  /** Die Adresse des Dienstes; ohne Angabe die aus der Umgebung. */
  baseUrl?: string;
  /**
   * Wird ausschliesslich von Tests gesetzt, um ohne echten Netzwerkzugriff
   * zu laufen (siehe stack.md: externe Dienste werden gemockt).
   */
  fetch?: typeof fetch;
  /** Zeitgrenze je Abruf; ohne Angabe OSRM_ZEITGRENZE_MS. */
  zeitgrenzeMs?: number;
  /** Pausen zwischen den Versuchen; ohne Angabe OSRM_WARTEZEITEN_MS. */
  wartezeitenMs?: readonly number[];
}

export function createOsrmClient({
  baseUrl,
  fetch: fetchImpl,
  zeitgrenzeMs = OSRM_ZEITGRENZE_MS,
  wartezeitenMs = OSRM_WARTEZEITEN_MS,
}: OsrmOptions = {}): RoutingClient {
  const holen = fetchImpl ?? fetch;
  const adresse = (profil: Routenprofil) =>
    (baseUrl ?? environmentOsrmBaseUrl(profil)).replace(/\/+$/, "");

  /** Die Antwort des Dienstes zur Route; null, wenn keine zu haben ist. */
  async function routenAntwort(
    von: Wegpunkt,
    nach: Wegpunkt,
    profil: Routenprofil,
    { abschnitte = false, verlauf = false } = {},
  ): Promise<unknown | null> {
    // OSRM erwartet die Koordinaten als "Laenge,Breite" -- umgekehrt zur
    // Schreibweise, die sonst im Projekt gilt.
    const url =
      `${adresse(profil)}/route/v1/${OSRM_PROFIL[profil]}/` +
      `${von.lng},${von.lat};${nach.lng},${nach.lat}` +
      // Der Verlauf ist die Punktfolge der Strasse (req-059); wer nur Zahlen
      // braucht, holt ihn nicht mit.
      (verlauf ? `?overview=full&geometries=geojson` : `?overview=false`) +
      `&alternatives=false` +
      // Die Abschnitte tragen die Wegbeschreibung (req-059).
      (abschnitte ? "&steps=true" : "");

    const versuche = wartezeitenMs.length + 1;
    for (let versuch = 1; versuch <= versuche; versuch++) {
      const ergebnis = await einAbruf(url);
      if (ergebnis.art === "antwort") {
        protokolliereFachlicheAntwort(profil, ergebnis.body);
        return ergebnis.body;
      }

      protokolliereFehlschlag(profil, versuch, versuche, ergebnis.grund);
      if (ergebnis.art === "endgueltig" || versuch === versuche) break;
      await warten(wartezeitenMs[versuch - 1] ?? 0);
    }
    return null;
  }

  /**
   * Ein einzelner Abruf samt Zeitgrenze. Ob ein Fehlschlag sich zu
   * wiederholen lohnt, entscheidet seine Ursache: eine Verbindung, die nicht
   * zustande kam, ein Zeitueberlauf oder eine Stoerung beim Dienst (HTTP 5xx,
   * 429) ja -- eine Antwort, die der Dienst bewusst gibt, nein.
   */
  async function einAbruf(url: string): Promise<Abrufergebnis> {
    let response: Response;
    try {
      response = await holen(url, {
        signal: AbortSignal.timeout(zeitgrenzeMs),
      });
    } catch (fehler) {
      return { art: "voruebergehend", grund: grundDes(fehler) };
    }

    if (!response.ok) {
      const grund = `http-${response.status}`;
      const voruebergehend = response.status >= 500 || response.status === 429;
      // OSRM antwortet auf "keine Route" mit 400 und nennt den Grund im
      // Inhalt -- das ist eine fachliche Antwort, kein Ausfall.
      if (!voruebergehend) {
        const body = await response.json().catch(() => null);
        const code = (body as { code?: unknown } | null)?.code;
        if (typeof code === "string") return { art: "antwort", body };
      }
      return { art: voruebergehend ? "voruebergehend" : "endgueltig", grund };
    }

    try {
      return { art: "antwort", body: await response.json() };
    } catch (fehler) {
      return { art: "endgueltig", grund: `unlesbar (${grundDes(fehler)})` };
    }
  }

  return {
    async fahrzeitMinuten(
      von: Wegpunkt,
      nach: Wegpunkt,
    ): Promise<number | null> {
      return fahrzeitAus(await routenAntwort(von, nach, "auto"));
    },

    async strecke(
      von: Wegpunkt,
      nach: Wegpunkt,
      profil: Routenprofil = "auto",
    ): Promise<Fahrstrecke | null> {
      const body = await routenAntwort(von, nach, profil, {
        abschnitte: true,
      });
      const dauerMinuten = fahrzeitAus(body);
      const distanzKm = laengeAus(body);
      if (dauerMinuten === null || distanzKm === null) return null;

      return { dauerMinuten, distanzKm, abschnitte: abschnitteAus(body) };
    },

    async verlauf(
      von: Wegpunkt,
      nach: Wegpunkt,
      profil: Routenprofil = "auto",
    ): Promise<Wegpunkt[] | null> {
      return verlaufAus(
        await routenAntwort(von, nach, profil, { verlauf: true }),
      );
    },
  };
}

type Abrufergebnis =
  | { art: "antwort"; body: unknown }
  | { art: "voruebergehend" | "endgueltig"; grund: string };

function warten(ms: number): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, ms));
}

/**
 * Die Ursache eines geworfenen Fehlers in greppbarer Form (bug-067). Node
 * meldet eine abgewiesene Verbindung als "fetch failed" und legt den
 * eigentlichen Grund (`ECONNREFUSED`, `ENOTFOUND`, ...) in `cause` ab --
 * genau der ist fuer die Fehlersuche entscheidend.
 */
function grundDes(fehler: unknown): string {
  if (fehler instanceof Error || fehler instanceof DOMException) {
    if (fehler.name === "TimeoutError") return "zeitueberlauf";
    const ursache = (fehler as { cause?: unknown }).cause as
      | { code?: unknown; message?: unknown }
      | undefined;
    if (typeof ursache?.code === "string") return ursache.code;
    if (typeof ursache?.message === "string") return ursache.message;
    return fehler.message || fehler.name;
  }
  return String(fehler);
}

/**
 * Ein gescheiterter Abruf im Server-Log (bug-067). Die Zeile nennt Profil,
 * Versuch und Ursache -- nie die Koordinaten: die Position der Gruppe
 * gehoert nicht ins Log.
 */
function protokolliereFehlschlag(
  profil: Routenprofil,
  versuch: number,
  versuche: number,
  grund: string,
): void {
  console.warn(
    `routing: profil=${profil} versuch=${versuch}/${versuche} grund=${grund}`,
  );
}

/**
 * Eine Antwort ohne Route. Sie ist richtig und kein Ausfall, steht aber im
 * Log, damit sich "keine Route" von "Dienst stumm" unterscheiden laesst.
 */
function protokolliereFachlicheAntwort(
  profil: Routenprofil,
  body: unknown,
): void {
  const code = (body as { code?: unknown } | null)?.code;
  if (code === "Ok") return;
  console.info(`routing: profil=${profil} antwort=${String(code)}`);
}

/** Die erste Route der Antwort; null, wenn die Antwort keine hergibt. */
function ersteRoute(
  body: unknown,
): { duration?: unknown; distance?: unknown; legs?: unknown } | null {
  const record = body as { code?: unknown; routes?: unknown } | null;
  if (record?.code !== "Ok" || !Array.isArray(record.routes)) return null;

  return (record.routes[0] as { duration?: unknown } | undefined) ?? null;
}

/** Die Dauer der ersten Route in Minuten; null, wenn die Antwort keine hergibt. */
function fahrzeitAus(body: unknown): number | null {
  const duration = ersteRoute(body)?.duration;
  if (typeof duration !== "number" || !Number.isFinite(duration)) return null;

  return duration / 60;
}

/** Die Laenge der ersten Route in Kilometern (req-052). */
function laengeAus(body: unknown): number | null {
  const distance = ersteRoute(body)?.distance;
  if (typeof distance !== "number" || !Number.isFinite(distance)) return null;

  return distance / 1000;
}

/**
 * Die Abschnitte der ersten Route (req-059), in ihrer Reihenfolge. OSRM nennt
 * je Abschnitt die Strasse (`name`, ersatzweise ihre Nummer `ref`) und ihre
 * Laenge; Abschnitte ohne Laenge -- Anfang und Ende der Route -- entfallen.
 */
function abschnitteAus(body: unknown): Wegabschnitt[] {
  const legs = ersteRoute(body)?.legs;
  if (!Array.isArray(legs)) return [];

  const abschnitte: Wegabschnitt[] = [];
  for (const leg of legs) {
    const steps = (leg as { steps?: unknown } | null)?.steps;
    if (!Array.isArray(steps)) continue;

    for (const step of steps) {
      const eintrag = step as {
        name?: unknown;
        ref?: unknown;
        distance?: unknown;
      };
      const distance = eintrag.distance;
      if (typeof distance !== "number" || !Number.isFinite(distance)) continue;
      if (distance <= 0) continue;

      abschnitte.push({
        strasse: strasseAus(eintrag.name) || strasseAus(eintrag.ref),
        distanzKm: distance / 1000,
      });
    }
  }
  return abschnitte;
}

/**
 * Der Strassenverlauf der ersten Route (req-059) als Punktfolge; null, wenn
 * die Antwort keinen hergibt. OSRM schreibt die Koordinaten als
 * "Laenge,Breite" -- hier werden sie zurueckgedreht.
 */
function verlaufAus(body: unknown): Wegpunkt[] | null {
  const geometry = (ersteRoute(body) as { geometry?: unknown } | null)
    ?.geometry;
  const coordinates = (geometry as { coordinates?: unknown } | null)
    ?.coordinates;
  if (!Array.isArray(coordinates)) return null;

  const verlauf: Wegpunkt[] = [];
  for (const punkt of coordinates) {
    if (!Array.isArray(punkt) || punkt.length < 2) continue;
    const [lng, lat] = punkt;
    if (typeof lng !== "number" || typeof lat !== "number") continue;
    verlauf.push({ lat, lng });
  }

  // Ein Verlauf aus weniger als zwei Punkten ist keine Linie.
  return verlauf.length >= 2 ? verlauf : null;
}

/** Der Name einer Strasse aus der Antwort; leer, wenn keiner darin steht. */
function strasseAus(wert: unknown): string {
  return typeof wert === "string" ? wert.trim() : "";
}

/**
 * Die Adresse des Routing-Dienstes aus der Umgebung, sonst die oeffentliche
 * des Profils.
 */
export function environmentOsrmBaseUrl(profil: Routenprofil = "auto"): string {
  // Ein leer durchgereichter Wert zaehlt wie ein fehlender (bug-032).
  return envWert("OSRM_BASE_URL") ?? DEFAULT_BASE_URL[profil];
}
