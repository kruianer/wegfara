// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { createAccountWithFirstPerson } from "../accounts/create-account";
import { switchToAccount } from "../accounts/switch-account";
import { createSession, findSessionByToken } from "./sessions";
import { createTrip, listTripsForSession } from "./trips";
import { assignTripParticipant } from "./trip-participants";
import { enableLogin, listParticipants } from "./participants";
import type { Session } from "../auth/types";

/**
 * Die Trennung zwischen zwei Accounts (req-025): jeder mit seinem eigenen
 * Kreis und seinen eigenen Reisen. Der Gesamt-Admin kommt an die Reisen
 * eines fremden Accounts nur ueber den Wechsel -- und sieht dann genau
 * diesen einen, nie beide nebeneinander.
 */

const NOW = new Date("2026-09-03T12:00:00Z");

const TOSKANA = {
  title: "Toskana 2027",
  startDate: "2027-05-12",
  endDate: "2027-05-19",
  mainPlace: { name: "Florenz", lat: 43.7696, lng: 11.2558 },
  description: "",
};

const ALLGAEU = {
  title: "Allgäu 2027",
  startDate: "2027-07-01",
  endDate: "2027-07-08",
  mainPlace: { name: "Oberstdorf", lat: 47.4098, lng: 10.2794 },
  description: "",
};

type Pool = ReturnType<typeof createTestDb>;

async function sitzung(
  pool: Pool,
  participantId: string,
  token: string,
): Promise<Session> {
  return createSession(pool, participantId, token, NOW);
}

/** Der Account "Familie Huber" mit Anna, die ihren Zugang eingeloest hat. */
async function familieHuber(pool: Pool) {
  const account = await createAccountWithFirstPerson(
    pool,
    {
      name: "Familie Huber",
      personName: "Anna Huber",
      personEmail: "anna@huber.de",
    },
    NOW,
  );
  const anna = (await listParticipants(pool, account!.id))[0];
  await enableLogin(pool, anna.id);
  return { accountId: account!.id, anna };
}

/** Eine Reise des Betreibers, ihm als Reiseleiter zugeordnet. */
async function reiseDesBetreibers(pool: Pool) {
  const trip = await createTrip(pool, ACCOUNT_ID, TOSKANA);
  await assignTripParticipant(
    pool,
    ACCOUNT_ID,
    trip.id,
    PARTICIPANT_ID,
    "reiseleiter",
  );
  return trip;
}

describe("Trennung der Accounts (req-025)", () => {
  it("zeigt Anna die Reisen des Betreibers nicht", async () => {
    const pool = createTestDb();
    await reiseDesBetreibers(pool);
    const { anna } = await familieHuber(pool);

    const ihre = await listTripsForSession(
      pool,
      await sitzung(pool, anna.id, "token-anna"),
    );

    expect(ihre).toEqual([]);
  });

  it("zeigt dem Betreiber die Reisen von Anna nicht", async () => {
    const pool = createTestDb();
    const eigene = await reiseDesBetreibers(pool);
    const { accountId, anna } = await familieHuber(pool);
    const ihre = await createTrip(pool, accountId, ALLGAEU);
    await assignTripParticipant(
      pool,
      accountId,
      ihre.id,
      anna.id,
      "reiseleiter",
    );

    const meine = (
      await listTripsForSession(
        pool,
        await sitzung(pool, PARTICIPANT_ID, "token-uwe"),
      )
    ).map((trip) => trip.id);

    expect(meine).toContain(eigene.id);
    expect(meine).not.toContain(ihre.id);
  });

  it("zeigt dem Gesamt-Admin nach dem Wechsel die Reisen des fremden Accounts", async () => {
    const pool = createTestDb();
    await reiseDesBetreibers(pool);
    const { accountId, anna } = await familieHuber(pool);
    const ihre = await createTrip(pool, accountId, ALLGAEU);
    await assignTripParticipant(
      pool,
      accountId,
      ihre.id,
      anna.id,
      "reiseleiter",
    );

    const session = await sitzung(pool, PARTICIPANT_ID, "token-uwe");
    await switchToAccount(pool, session, accountId, NOW);
    const gewechselt = await findSessionByToken(pool, "token-uwe", NOW);
    const sichtbar = await listTripsForSession(pool, gewechselt!);

    // Genau der eine Account -- die eigene Reise ist dabei nicht zu sehen.
    expect(sichtbar.map((trip) => trip.id)).toEqual([ihre.id]);
  });

  it("zeigt dem Gesamt-Admin nach der Rueckkehr wieder seine eigenen Reisen", async () => {
    const pool = createTestDb();
    const eigene = await reiseDesBetreibers(pool);
    const { accountId } = await familieHuber(pool);
    const ihre = await createTrip(pool, accountId, ALLGAEU);

    const session = await sitzung(pool, PARTICIPANT_ID, "token-uwe");
    await switchToAccount(pool, session, accountId, NOW);
    await switchToAccount(pool, session, ACCOUNT_ID, NOW);
    const zurueck = await findSessionByToken(pool, "token-uwe", NOW);
    const meine = (await listTripsForSession(pool, zurueck!)).map(
      (trip) => trip.id,
    );

    expect(meine).toContain(eigene.id);
    expect(meine).not.toContain(ihre.id);
  });
});
