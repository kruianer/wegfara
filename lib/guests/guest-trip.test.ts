// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { createAccount } from "../db/accounts";
import { createTrip } from "../db/trips";
import { loadGuestTrip } from "./guest-trip";
import type { GuestSession } from "./types";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "9f0e6b4b-0bd5-4e2e-9a1b-1b3f0f8c7f21";

function gast(overrides: Partial<GuestSession> = {}): GuestSession {
  return {
    id: "1a2b3c4d-0000-4000-8000-000000000001",
    guestAccessId: "1a2b3c4d-0000-4000-8000-000000000002",
    accountId: ACCOUNT_ID,
    tripId: SUEDITALIEN_ID,
    purpose: "Nachbarin Eva",
    expiresAt: new Date("2026-09-11T10:00:00Z"),
    ...overrides,
  };
}

describe("loadGuestTrip (req-038)", () => {
  it("liefert Plan, Programmpunkte und POIs der freigegebenen Reise", async () => {
    const pool = createTestDb();

    const data = await loadGuestTrip(pool, gast());

    expect(data?.trip.id).toBe(SUEDITALIEN_ID);
    expect(data?.pois.length).toBeGreaterThan(0);
    expect(data?.activities.length).toBeGreaterThan(0);
  });

  it("liefert nichts aus einer anderen Reise -- der Zugang gilt fuer genau eine", async () => {
    const pool = createTestDb();

    const data = await loadGuestTrip(pool, gast());

    expect(data?.pois.every((poi) => poi.tripId === SUEDITALIEN_ID)).toBe(true);
    expect(
      data?.activities.every((activity) => activity.tripId === SUEDITALIEN_ID),
    ).toBe(true);
    expect(
      data?.transfers.every((transfer) => transfer.tripId === SUEDITALIEN_ID),
    ).toBe(true);
    // Die Demodaten haben mehr als eine Reise -- die andere kommt hier nicht
    // vor.
    expect(data?.trip.id).not.toBe(WIEN_ID);
  });

  it("liefert nichts, wenn die Reise nicht zum Account des Zugangs gehoert", async () => {
    const pool = createTestDb();
    const fremder = await createAccount(
      pool,
      "Familie Berger",
      "berger@example.com",
    );
    const fremdeReise = await createTrip(pool, fremder.id, {
      title: "Fremde Reise",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      mainPlace: { name: "Graz", lat: 47.07, lng: 15.44 },
      description: "",
    });

    expect(
      await loadGuestTrip(pool, gast({ tripId: fremdeReise.id })),
    ).toBeNull();
  });

  it("liefert nichts zu einer unbekannten Reise", async () => {
    const pool = createTestDb();

    expect(
      await loadGuestTrip(
        pool,
        gast({ tripId: "00000000-0000-4000-8000-000000000009" }),
      ),
    ).toBeNull();
  });

  it("bringt weder Ausgaben noch Dokumente noch Teilnehmerdaten mit", async () => {
    const pool = createTestDb();

    const data = await loadGuestTrip(pool, gast());

    // Was ein Gast nicht sehen darf, steht gar nicht erst im Ergebnis.
    expect(Object.keys(data ?? {}).sort()).toEqual([
      "activities",
      "optionSelections",
      "pois",
      "transfers",
      "trip",
    ]);
    expect(JSON.stringify(data)).not.toContain(PARTICIPANT_ID);
  });
});
