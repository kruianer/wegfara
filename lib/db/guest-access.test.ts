// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { hashSecret } from "@/lib/auth/tokens";
import { guestAccessExpiresAt } from "@/lib/guests/duration";
import {
  createGuestAccess,
  deleteExpiredGuestSessions,
  findGuestAccess,
  findGuestSessionByToken,
  listGuestAccesses,
  revokeGuestAccess,
  startGuestSession,
} from "./guest-access";
import { createAccount } from "./accounts";
import { createTrip } from "./trips";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date("2026-09-04T10:00:00Z");
const SPAETER = new Date("2026-09-05T10:00:00Z");

type Pool = ReturnType<typeof createTestDb>;

function anlegen(
  pool: Pool,
  overrides: Partial<Parameters<typeof createGuestAccess>[1]> = {},
  now = NOW,
) {
  return createGuestAccess(
    pool,
    {
      accountId: ACCOUNT_ID,
      tripId: SUEDITALIEN_ID,
      createdBy: PARTICIPANT_ID,
      purpose: "Nachbarin Eva",
      token: "gast-token",
      expiresAt: guestAccessExpiresAt(now, 7 * 24),
      ...overrides,
    },
    now,
  );
}

describe("createGuestAccess (req-038)", () => {
  it("legt den Zugang mit Zweck, Reise und Ablauf an", async () => {
    const pool = createTestDb();

    const access = await anlegen(pool);

    expect(access).toMatchObject({
      tripId: SUEDITALIEN_ID,
      tripTitle: "Süditalien Rundreise",
      purpose: "Nachbarin Eva",
      lastUsedAt: null,
      revokedAt: null,
      status: "aktiv",
    });
    expect(access?.expiresAt).toBe("2026-09-11T10:00:00.000Z");
  });

  it("speichert das Geheimnis ausschliesslich als Pruefsumme", async () => {
    const pool = createTestDb();
    await anlegen(pool, { token: "geheim-123" });

    const { rows } = await pool.query(
      `select token_hash from guest_access`,
      [],
    );

    expect(rows[0].token_hash).toBe(hashSecret("geheim-123"));
    expect(rows[0].token_hash).not.toContain("geheim-123");
  });
});

describe("findGuestAccess / listGuestAccesses (req-038)", () => {
  it("zeigt einen Gastzugang eines anderen Accounts nicht -- auch nicht mit seiner Id", async () => {
    const pool = createTestDb();
    const access = await anlegen(pool);
    const fremder = await createAccount(
      pool,
      "Familie Berger",
      "b@example.com",
    );

    expect(await findGuestAccess(pool, fremder.id, access!.id, NOW)).toBeNull();
    expect(await listGuestAccesses(pool, fremder.id, NOW)).toEqual([]);
  });

  it("listet die Zugaenge des eigenen Accounts", async () => {
    const pool = createTestDb();
    await anlegen(pool, { purpose: "Nachbarin Eva", token: "a" });
    await anlegen(pool, { purpose: "Onkel Karl", token: "b" }, SPAETER);

    const liste = await listGuestAccesses(pool, ACCOUNT_ID, SPAETER);

    // Der neueste zuerst.
    expect(liste.map((eintrag) => eintrag.purpose)).toEqual([
      "Onkel Karl",
      "Nachbarin Eva",
    ]);
  });
});

describe("startGuestSession (req-038)", () => {
  it("legt eine Sitzung an und haelt die Verwendung fest", async () => {
    const pool = createTestDb();
    const access = await anlegen(pool, { token: "gastlink" });

    const result = await startGuestSession(pool, "gastlink", SPAETER);

    expect(result?.session).toMatchObject({
      accountId: ACCOUNT_ID,
      tripId: SUEDITALIEN_ID,
      guestAccessId: access!.id,
    });
    expect(
      (await findGuestAccess(pool, ACCOUNT_ID, access!.id, SPAETER))
        ?.lastUsedAt,
    ).toBe(SPAETER.toISOString());
  });

  it("endet nie spaeter als der Gastzugang", async () => {
    const pool = createTestDb();
    // Nur eine Stunde -- deutlich kuerzer als die 90 Tage einer
    // Teilnehmer-Sitzung (req-023).
    await anlegen(pool, {
      token: "kurz",
      expiresAt: guestAccessExpiresAt(NOW, 1),
    });

    const result = await startGuestSession(pool, "kurz", NOW);

    expect(result?.session.expiresAt.toISOString()).toBe(
      "2026-09-04T11:00:00.000Z",
    );
  });

  it("weist einen widerrufenen Link ab", async () => {
    const pool = createTestDb();
    const access = await anlegen(pool, { token: "gastlink" });
    await revokeGuestAccess(pool, ACCOUNT_ID, access!.id, NOW);

    expect(await startGuestSession(pool, "gastlink", SPAETER)).toBeNull();
  });

  it("weist einen abgelaufenen Link ab", async () => {
    const pool = createTestDb();
    await anlegen(pool, {
      token: "gastlink",
      expiresAt: guestAccessExpiresAt(NOW, 1),
    });

    expect(await startGuestSession(pool, "gastlink", SPAETER)).toBeNull();
  });

  it("weist ein unbekanntes und ein leeres Token ab", async () => {
    const pool = createTestDb();
    await anlegen(pool, { token: "gastlink" });

    expect(await startGuestSession(pool, "anderes", NOW)).toBeNull();
    expect(await startGuestSession(pool, "", NOW)).toBeNull();
  });

  it("laesst denselben Link bis zum Ablauf mehrfach zu -- anders als eine Einladung", async () => {
    const pool = createTestDb();
    await anlegen(pool, { token: "gastlink" });

    expect(await startGuestSession(pool, "gastlink", NOW)).not.toBeNull();
    expect(await startGuestSession(pool, "gastlink", SPAETER)).not.toBeNull();
  });
});

describe("findGuestSessionByToken (req-038)", () => {
  it("findet die laufende Sitzung", async () => {
    const pool = createTestDb();
    await anlegen(pool, { token: "gastlink" });
    const result = await startGuestSession(pool, "gastlink", NOW);

    expect(
      await findGuestSessionByToken(pool, result!.token, SPAETER),
    ).toMatchObject({ tripId: SUEDITALIEN_ID, accountId: ACCOUNT_ID });
  });

  it("endet sofort, wenn der Gastzugang widerrufen wird", async () => {
    const pool = createTestDb();
    const access = await anlegen(pool, { token: "gastlink" });
    const result = await startGuestSession(pool, "gastlink", NOW);

    await revokeGuestAccess(pool, ACCOUNT_ID, access!.id, SPAETER);

    expect(
      await findGuestSessionByToken(pool, result!.token, SPAETER),
    ).toBeNull();
  });

  it("endet mit dem Ablauf des Gastzugangs", async () => {
    const pool = createTestDb();
    await anlegen(pool, {
      token: "gastlink",
      expiresAt: guestAccessExpiresAt(NOW, 1),
    });
    const result = await startGuestSession(pool, "gastlink", NOW);

    expect(
      await findGuestSessionByToken(pool, result!.token, SPAETER),
    ).toBeNull();
  });

  it("speichert auch das Sitzungs-Token nur als Pruefsumme", async () => {
    const pool = createTestDb();
    await anlegen(pool, { token: "gastlink" });
    const result = await startGuestSession(pool, "gastlink", NOW);

    const { rows } = await pool.query(
      `select token_hash from guest_session`,
      [],
    );

    expect(rows[0].token_hash).toBe(hashSecret(result!.token));
  });
});

describe("revokeGuestAccess (req-038)", () => {
  it("setzt den Widerruf und beendet die laufende Gast-Sitzung", async () => {
    const pool = createTestDb();
    const access = await anlegen(pool, { token: "gastlink" });
    await startGuestSession(pool, "gastlink", NOW);

    const widerrufen = await revokeGuestAccess(
      pool,
      ACCOUNT_ID,
      access!.id,
      SPAETER,
    );

    expect(widerrufen?.status).toBe("widerrufen");
    const { rows } = await pool.query(`select id from guest_session`, []);
    expect(rows).toHaveLength(0);
  });

  it("widerruft keinen Zugang eines fremden Accounts", async () => {
    const pool = createTestDb();
    const access = await anlegen(pool);
    const fremder = await createAccount(
      pool,
      "Familie Berger",
      "b@example.com",
    );

    expect(
      await revokeGuestAccess(pool, fremder.id, access!.id, SPAETER),
    ).toBeNull();
    expect(
      (await findGuestAccess(pool, ACCOUNT_ID, access!.id, SPAETER))?.status,
    ).toBe("aktiv");
  });

  it("laesst den Zeitpunkt eines bereits widerrufenen Zugangs stehen", async () => {
    const pool = createTestDb();
    const access = await anlegen(pool);
    await revokeGuestAccess(pool, ACCOUNT_ID, access!.id, NOW);

    const nochmal = await revokeGuestAccess(
      pool,
      ACCOUNT_ID,
      access!.id,
      SPAETER,
    );

    expect(nochmal?.revokedAt).toBe(NOW.toISOString());
  });
});

describe("Gastzugang und Reise (req-038)", () => {
  it("verschwindet mit seiner Reise", async () => {
    const pool = createTestDb();
    const reise = await createTrip(pool, ACCOUNT_ID, {
      title: "Kurztrip",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      mainPlace: { name: "Graz", lat: 47.07, lng: 15.44 },
      description: "",
    });
    await anlegen(pool, { tripId: reise.id, token: "zweiter" });

    await pool.query(`delete from trip where id = $1`, [reise.id]);

    expect(await listGuestAccesses(pool, ACCOUNT_ID, NOW)).toEqual([]);
  });
});

describe("deleteExpiredGuestSessions (req-038)", () => {
  it("raeumt abgelaufene Gast-Sitzungen weg", async () => {
    const pool = createTestDb();
    await anlegen(pool, {
      token: "gastlink",
      expiresAt: guestAccessExpiresAt(NOW, 1),
    });
    await startGuestSession(pool, "gastlink", NOW);

    await deleteExpiredGuestSessions(pool, SPAETER);

    const { rows } = await pool.query(`select id from guest_session`, []);
    expect(rows).toHaveLength(0);
  });
});
