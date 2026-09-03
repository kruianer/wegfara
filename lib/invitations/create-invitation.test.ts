// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { createParticipant } from "../db/participants";
import { assignTripParticipant } from "../db/trip-participants";
import { consumeAccessLink } from "../db/access-links";
import { createAccount } from "../db/accounts";
import { createAccountWithFirstPerson } from "../accounts/create-account";
import {
  createFirstPersonInvitation,
  createInvitation,
} from "./create-invitation";

type Pool = ReturnType<typeof createTestDb>;

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date("2026-09-03T12:00:00Z");

/** Zieht das Token aus dem Zugangslink -- nur dort steht es im Klartext. */
function tokenFrom(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get("token") ?? "");
}

async function claraInSueditalien(pool: Pool) {
  const person = await createParticipant(
    pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    },
    NOW,
  );
  await assignTripParticipant(
    pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    person.id,
    "teilnehmer",
  );
  return person;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createInvitation (req-023)", () => {
  it("erzeugt einen Zugangslink samt QR-Code fuer eine zugeordnete Person", async () => {
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");
    const pool = createTestDb();
    const person = await claraInSueditalien(pool);

    const invitation = await createInvitation(pool, ACCOUNT_ID, person.id, NOW);

    expect(invitation?.participantId).toBe(person.id);
    expect(invitation?.url).toMatch(
      /^https:\/\/dev\.wegfara\.com\/einladung\?token=/,
    );
    expect(invitation?.qr.path.length).toBeGreaterThan(0);
  });

  it("bindet den Link an genau diese Person", async () => {
    const pool = createTestDb();
    const person = await claraInSueditalien(pool);

    const invitation = await createInvitation(pool, ACCOUNT_ID, person.id, NOW);

    expect(await consumeAccessLink(pool, tokenFrom(invitation!.url), NOW)).toBe(
      person.id,
    );
  });

  it("entwertet mit einer neuen Einladung die vorherige", async () => {
    const pool = createTestDb();
    const person = await claraInSueditalien(pool);
    const erste = await createInvitation(pool, ACCOUNT_ID, person.id, NOW);

    const zweite = await createInvitation(pool, ACCOUNT_ID, person.id, NOW);

    expect(
      await consumeAccessLink(pool, tokenFrom(erste!.url), NOW),
    ).toBeNull();
    expect(await consumeAccessLink(pool, tokenFrom(zweite!.url), NOW)).toBe(
      person.id,
    );
  });

  it("laedt auch ein, solange die Reise auf „In Planung“ steht", async () => {
    const pool = createTestDb();
    const person = await claraInSueditalien(pool);

    expect(await createInvitation(pool, ACCOUNT_ID, person.id, NOW)).not.toBe(
      null,
    );
  });

  it("laedt niemanden ein, der keiner Reise zugeordnet ist", async () => {
    const pool = createTestDb();
    const person = await createParticipant(
      pool,
      ACCOUNT_ID,
      {
        name: "Max Gast",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      NOW,
    );

    expect(await createInvitation(pool, ACCOUNT_ID, person.id, NOW)).toBeNull();
  });

  it("laedt niemanden aus einem fremden Account ein", async () => {
    const pool = createTestDb();

    expect(
      await createInvitation(pool, randomUUID(), PARTICIPANT_ID, NOW),
    ).toBeNull();
  });

  it("legt den Zugangslink nur als Pruefsumme ab", async () => {
    const pool = createTestDb();
    const person = await claraInSueditalien(pool);

    const invitation = await createInvitation(pool, ACCOUNT_ID, person.id, NOW);

    const { rows } = await pool.query("select token_hash from access_link");
    expect(rows).toHaveLength(1);
    expect((rows[0] as { token_hash: string }).token_hash).not.toContain(
      tokenFrom(invitation!.url),
    );
  });
});

describe("createFirstPersonInvitation (req-025)", () => {
  it("erzeugt den Zugangslink der ersten Person eines neuen Accounts", async () => {
    const pool = createTestDb();
    const account = await createAccountWithFirstPerson(
      pool,
      {
        name: "Familie Huber",
        personName: "Anna Huber",
        personEmail: "anna@huber.de",
      },
      NOW,
    );

    const invitation = await createFirstPersonInvitation(
      pool,
      account!.id,
      NOW,
    );

    // Eine Reise braucht es dafuer nicht -- der Account ist gerade erst
    // angelegt und hat noch keine.
    expect(invitation?.participantId).toBe(account!.firstPerson!.id);
    expect(await consumeAccessLink(pool, tokenFrom(invitation!.url), NOW)).toBe(
      account!.firstPerson!.id,
    );
  });

  it("entwertet die vorherige Einladung derselben Person", async () => {
    const pool = createTestDb();
    const account = await createAccountWithFirstPerson(
      pool,
      {
        name: "Familie Huber",
        personName: "Anna Huber",
        personEmail: "anna@huber.de",
      },
      NOW,
    );
    const erste = await createFirstPersonInvitation(pool, account!.id, NOW);

    const zweite = await createFirstPersonInvitation(pool, account!.id, NOW);

    expect(
      await consumeAccessLink(pool, tokenFrom(erste!.url), NOW),
    ).toBeNull();
    expect(await consumeAccessLink(pool, tokenFrom(zweite!.url), NOW)).toBe(
      account!.firstPerson!.id,
    );
  });

  it("liefert null fuer einen Account ohne Person", async () => {
    const pool = createTestDb();
    const leer = await createAccount(pool, "Noch leer", "leer@example.com");

    expect(await createFirstPersonInvitation(pool, leer.id, NOW)).toBeNull();
  });
});
