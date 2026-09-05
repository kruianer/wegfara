import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createAccount } from "@/lib/db/accounts";
import { createParticipant, enableLogin } from "@/lib/db/participants";
import { createPoi } from "@/lib/db/pois";
import { createSession } from "@/lib/db/sessions";
import { createTrip } from "@/lib/db/trips";
import { assignTripParticipant } from "@/lib/db/trip-participants";
import { createRecoveryCodeSet } from "@/lib/auth/login";
import { createToken } from "@/lib/auth/tokens";
import type { Poi, PoiStatus, PoiType } from "@/lib/pois/types";

/**
 * Der Ausgangszustand der E2E-Fluesse (req-047). Angelegt wird er ueber
 * denselben Datenzugriffs-Layer, den die Anwendung benutzt -- nicht mit
 * eigenem SQL: was hier entsteht, sieht damit genauso aus wie im Betrieb.
 *
 * Jeder Test bekommt seinen eigenen Account. Weil jede Abfrage auf
 * Nutzerdaten nach Mandant filtert (siehe delivery/stack.md), sehen die
 * Tests einander nicht -- auch nicht ueber Laeufe hinweg, in denen dieselbe
 * Datenbank noch stuende.
 */

let pool: Pool | undefined;

/** Die Wegwerf-Datenbank des Laufs (siehe scripts/e2e.mjs). */
export function e2ePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL fehlt — die E2E-Tests laufen ueber `npm run test:e2e`.",
      );
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function schliesseE2ePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Der heutige Tag, wie ihn auch der Server bildet (siehe app/plan/page.tsx). */
export function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ein Datum, `tage` Tage nach `datum` (negativ: davor). */
export function tageSpaeter(datum: string, tage: number): string {
  const verschoben = new Date(`${datum}T00:00:00Z`);
  verschoben.setUTCDate(verschoben.getUTCDate() + tage);
  return verschoben.toISOString().slice(0, 10);
}

export interface E2eKontext {
  accountId: string;
  participantId: string;
  /** Gehoert ins Sitzungs-Cookie; in der Datenbank steht nur seine Pruefsumme. */
  sessionToken: string;
  /**
   * Die Reise, die die Person fuehrt. Ohne eine gefuehrte oder freigegebene
   * Reise endet die Sitzung beim Aufruf des Planers (req-023) -- jeder Fluss
   * braucht sie deshalb, auch der, der eine zweite Reise anlegt.
   */
  tripId: string;
  tripTitle: string;
  /** Kennzeichnet die Testdaten dieses einen Tests. */
  kennung: string;
}

export interface SeedOptionen {
  /** Zeitraum der gefuehrten Reise; ohne Angabe laeuft sie gerade. */
  tripStartDate?: string;
  tripEndDate?: string;
}

/**
 * Legt Account, Person, Sitzung und eine gefuehrte Reise an. Die
 * Notfallcodes entstehen gleich mit: sonst erzeugte sie die erste Anmeldung
 * und schoebe die Notfallcode-Seite dazwischen (req-023, siehe
 * lib/auth/login.ts).
 */
export async function seedKontext(
  optionen: SeedOptionen = {},
): Promise<E2eKontext> {
  const db = e2ePool();
  const jetzt = new Date();
  const kennung = randomUUID().slice(0, 8);
  const heuteIso = heute();

  const account = await createAccount(
    db,
    `E2E Account ${kennung}`,
    `e2e-konto-${kennung}@example.invalid`,
  );
  const person = await createParticipant(
    db,
    account.id,
    {
      name: `E2E Person ${kennung}`,
      nickname: null,
      email: `e2e-person-${kennung}@example.invalid`,
      phone: null,
      iban: null,
    },
    jetzt,
    true,
  );
  await enableLogin(db, person.id);

  const tripTitle = `E2E Reise ${kennung}`;
  const trip = await createTrip(db, account.id, {
    title: tripTitle,
    startDate: optionen.tripStartDate ?? tageSpaeter(heuteIso, -1),
    endDate: optionen.tripEndDate ?? tageSpaeter(heuteIso, 5),
    mainPlace: { name: "Teststadt", lat: 40.5, lng: 10.5 },
    description: "",
  });
  const zuordnung = await assignTripParticipant(
    db,
    account.id,
    trip.id,
    person.id,
    "reiseleiter",
  );
  if (!zuordnung.ok) {
    throw new Error("Die Reiseleitung liess sich nicht zuordnen.");
  }

  await createRecoveryCodeSet(db, person.id, jetzt);

  const sessionToken = createToken();
  await createSession(db, person.id, sessionToken, jetzt);

  return {
    accountId: account.id,
    participantId: person.id,
    sessionToken,
    tripId: trip.id,
    tripTitle,
    kennung,
  };
}

/** Ein gesammelter POI, wie ihn die Anwendung selbst anlegen wuerde. */
export async function seedPoi(
  kontext: E2eKontext,
  name: string,
  type: PoiType = "sehenswuerdigkeit",
  status: PoiStatus = "gesetzt",
): Promise<Poi> {
  const poi = await createPoi(e2ePool(), kontext.accountId, kontext.tripId, {
    name,
    ort: "Teststadt",
    type,
    position: { lat: 40.5, lng: 10.5 },
    status,
    shortText: null,
    longText: null,
    web: null,
    address: null,
    phone: null,
    openingHours: null,
  });
  if (!poi) throw new Error(`POI ${name} liess sich nicht anlegen.`);
  return poi;
}

/** Die POIs einer Reise, direkt aus der Datenbank. */
export async function poiNamenInDatenbank(
  kontext: E2eKontext,
): Promise<string[]> {
  const { rows } = await e2ePool().query<{ name: string }>(
    `select name from poi where trip_id = $1 order by number`,
    [kontext.tripId],
  );
  return rows.map((zeile) => zeile.name);
}
