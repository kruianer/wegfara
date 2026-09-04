// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { listAccountUsers, listOpenInvitations } from "./account-users";
import { createParticipant, setAccountAdmin } from "./participants";
import { createAccessLink, invalidateAccessLinks } from "./access-links";
import { createSession } from "./sessions";
import { createAccount } from "./accounts";

const NOW = new Date("2026-09-04T10:00:00Z");
const FRUEHER = new Date("2026-08-01T09:00:00Z");

const CLARA = {
  name: "Clara Berger",
  nickname: null,
  email: "clara@example.com",
  phone: null,
  iban: null,
};

describe("listAccountUsers (req-038)", () => {
  it("nennt Name, E-Mail, Kennzeichnung und Beitritt", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    const users = await listAccountUsers(pool, ACCOUNT_ID);

    expect(users.map((user) => user.id)).toEqual([PARTICIPANT_ID, clara.id]);
    expect(users[1]).toMatchObject({
      name: "Clara Berger",
      email: "clara@example.com",
      accountAdmin: false,
      loginEnabled: false,
      joinedAt: NOW.toISOString(),
      lastSignInAt: null,
    });
  });

  it("nennt die letzte Anmeldung aus der juengsten Sitzung", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "alt", FRUEHER);
    await createSession(pool, PARTICIPANT_ID, "neu", NOW);

    const [betreiber] = await listAccountUsers(pool, ACCOUNT_ID);

    expect(betreiber.lastSignInAt).toBe(NOW.toISOString());
  });

  it("nimmt auch die Passkey-Nutzung als letzte Anmeldung", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "alt", FRUEHER);
    await pool.query(
      `insert into credential (id, participant_id, public_key, counter, transports, label, created_at, last_used_at)
       values ('c1', $1, 'pk', 0, '', 'iPhone', $2, $3)`,
      [PARTICIPANT_ID, FRUEHER, NOW],
    );

    const [betreiber] = await listAccountUsers(pool, ACCOUNT_ID);

    expect(betreiber.lastSignInAt).toBe(NOW.toISOString());
  });

  it("zeigt die Kennzeichnung Account-Admin", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);
    await setAccountAdmin(pool, ACCOUNT_ID, clara.id, true);

    const users = await listAccountUsers(pool, ACCOUNT_ID);

    expect(users.find((user) => user.id === clara.id)?.accountAdmin).toBe(true);
  });

  it("zeigt keine Person eines fremden Accounts", async () => {
    const pool = createTestDb();
    const fremder = await createAccount(
      pool,
      "Familie Berger",
      "b@example.com",
    );
    await createParticipant(
      pool,
      fremder.id,
      { ...CLARA, email: "fremd@example.com" },
      NOW,
    );

    const users = await listAccountUsers(pool, ACCOUNT_ID);

    expect(users.map((user) => user.name)).not.toContain("Clara Berger");
  });
});

describe("listOpenInvitations (req-038)", () => {
  it("nennt Adresse und Ablaufdatum einer offenen Einladung", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);
    await createAccessLink(pool, clara.id, "einladungs-token", NOW);

    const offen = await listOpenInvitations(pool, ACCOUNT_ID, NOW);

    expect(offen).toEqual([
      {
        participantId: clara.id,
        name: "Clara Berger",
        email: "clara@example.com",
        // Sieben Tage (req-023).
        expiresAt: "2026-09-11T10:00:00.000Z",
      },
    ]);
  });

  it("zeigt eine zurueckgezogene Einladung nicht mehr", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);
    await createAccessLink(pool, clara.id, "einladungs-token", NOW);

    await invalidateAccessLinks(pool, clara.id, NOW);

    expect(await listOpenInvitations(pool, ACCOUNT_ID, NOW)).toEqual([]);
  });

  it("zeigt eine abgelaufene Einladung nicht mehr", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);
    await createAccessLink(pool, clara.id, "einladungs-token", FRUEHER);

    expect(await listOpenInvitations(pool, ACCOUNT_ID, NOW)).toEqual([]);
  });

  it("zeigt keine Einladung eines fremden Accounts", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);
    await createAccessLink(pool, clara.id, "einladungs-token", NOW);
    const fremder = await createAccount(
      pool,
      "Familie Berger",
      "b@example.com",
    );

    expect(await listOpenInvitations(pool, fremder.id, NOW)).toEqual([]);
  });
});
