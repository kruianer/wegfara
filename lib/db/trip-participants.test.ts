// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { ACCOUNT_ID } from "../account";
import { createParticipant, deleteParticipant } from "./participants";
import { deleteTrip, setTripState } from "./trips";
import {
  assignTripParticipant,
  isInAnyTrip,
  isInReleasedTrip,
  leadsAnyTrip,
  listTripParticipants,
  removeTripParticipant,
} from "./trip-participants";
import type { TripParticipant } from "../trip-participants/types";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

type Pool = ReturnType<typeof createTestDb>;

/** Eine weitere Person im Account, die noch keiner Reise zugeordnet ist. */
async function person(pool: Pool, name: string, minuten: number) {
  return createParticipant(
    pool,
    ACCOUNT_ID,
    { name, nickname: null, email: null, phone: null, iban: null },
    new Date(Date.UTC(2026, 7, 16, 0, minuten)),
  );
}

async function fremderAccountMitReise(pool: Pool) {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const participantId = randomUUID();
  await pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  await pool.query(
    `insert into participant (id, account_id, name, email, created_at)
     values ($1, $2, 'Fremde Person', 'fremd@example.com', $3)`,
    [participantId, accountId, new Date()],
  );
  return { accountId, tripId, participantId };
}

function zuordnungen(
  assignments: TripParticipant[],
  tripId: string,
): TripParticipant[] {
  return assignments.filter((assignment) => assignment.tripId === tripId);
}

describe("listTripParticipants (req-021)", () => {
  it("ordnet den Betreiber allen bestehenden Reisen als Reiseleiter zu", async () => {
    const pool = createTestDb();

    const assignments = await listTripParticipants(pool, ACCOUNT_ID);

    expect(assignments).toHaveLength(3);
    for (const assignment of assignments) {
      expect(assignment).toMatchObject({
        participantId: PARTICIPANT_ID,
        role: "reiseleiter",
      });
    }
  });

  it("liefert keine Zuordnungen eines anderen Accounts (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);
    await pool.query(
      `insert into trip_participant (trip_id, participant_id, role)
       values ($1, $2, 'reiseleiter')`,
      [fremd.tripId, fremd.participantId],
    );

    const assignments = await listTripParticipants(pool, ACCOUNT_ID);

    expect(assignments.some((a) => a.tripId === fremd.tripId)).toBe(false);
  });
});

describe("assignTripParticipant (req-021)", () => {
  it("ordnet eine Person der geoeffneten Reise zu", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);

    const result = await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );

    expect(result).toEqual({
      ok: true,
      tripParticipant: {
        tripId: SUEDITALIEN_ID,
        participantId: clara.id,
        role: "teilnehmer",
      },
    });
    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    expect(zuordnungen(assignments, SUEDITALIEN_ID)).toHaveLength(2);
  });

  it("laesst die Zuordnung der anderen Reisen unberuehrt", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);

    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );

    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    expect(
      zuordnungen(assignments, WIEN_ID).some(
        (a) => a.participantId === clara.id,
      ),
    ).toBe(false);
  });

  it("ordnet dieselbe Person derselben Reise nur einmal zu", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);

    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "reiseleiter",
    );

    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    const claras = zuordnungen(assignments, SUEDITALIEN_ID).filter(
      (a) => a.participantId === clara.id,
    );
    expect(claras).toEqual([
      {
        tripId: SUEDITALIEN_ID,
        participantId: clara.id,
        role: "reiseleiter",
      },
    ]);
  });

  it("laesst dieselbe Person in zwei Reisen verschiedene Rollen tragen", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);

    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "reiseleiter",
    );
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      clara.id,
      "teilnehmer",
    );

    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    expect(
      assignments.find(
        (a) => a.tripId === SUEDITALIEN_ID && a.participantId === clara.id,
      )?.role,
    ).toBe("reiseleiter");
    expect(
      assignments.find(
        (a) => a.tripId === WIEN_ID && a.participantId === clara.id,
      )?.role,
    ).toBe("teilnehmer");
  });

  it("stuft den letzten Reiseleiter nicht zum Teilnehmer herab", async () => {
    const pool = createTestDb();

    const result = await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      "teilnehmer",
    );

    expect(result).toEqual({ ok: false, reason: "lastLeader" });
    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    expect(
      assignments.find(
        (a) =>
          a.tripId === SUEDITALIEN_ID && a.participantId === PARTICIPANT_ID,
      )?.role,
    ).toBe("reiseleiter");
  });

  it("stuft einen von zwei Reiseleitern herab", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "reiseleiter",
    );

    const result = await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      "teilnehmer",
    );

    expect(result.ok).toBe(true);
  });

  it("ordnet keine Person einer Reise eines anderen Accounts zu", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);

    const result = await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      fremd.tripId,
      PARTICIPANT_ID,
      "teilnehmer",
    );

    expect(result).toEqual({ ok: false, reason: "unknown" });
  });

  it("ordnet keine Person eines anderen Accounts zu", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);

    const result = await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      fremd.participantId,
      "teilnehmer",
    );

    expect(result).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("removeTripParticipant (req-021)", () => {
  it("nimmt eine Person aus der Reise, ohne sie aus dem Account zu entfernen", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );

    expect(
      await removeTripParticipant(pool, ACCOUNT_ID, SUEDITALIEN_ID, clara.id),
    ).toEqual({ ok: true });

    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    expect(zuordnungen(assignments, SUEDITALIEN_ID)).toHaveLength(1);
    const { rows } = await pool.query(
      "select id from participant where id = $1",
      [clara.id],
    );
    expect(rows).toHaveLength(1);
  });

  it("entfernt den letzten Reiseleiter nicht", async () => {
    const pool = createTestDb();

    const result = await removeTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
    );

    expect(result).toEqual({ ok: false, reason: "lastLeader" });
    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    expect(zuordnungen(assignments, SUEDITALIEN_ID)).toHaveLength(1);
  });

  it("meldet eine Person, die der Reise gar nicht zugeordnet ist", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);

    expect(
      await removeTripParticipant(pool, ACCOUNT_ID, SUEDITALIEN_ID, clara.id),
    ).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("Zuordnungen und die Reise (req-021)", () => {
  it("verschwinden mit der geloeschten Reise", async () => {
    const pool = createTestDb();

    await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID);

    const { rows } = await pool.query(
      "select participant_id from trip_participant where trip_id = $1",
      [SUEDITALIEN_ID],
    );
    expect(rows).toHaveLength(0);
  });
});

describe("Zuordnungen und die Person (req-021)", () => {
  it("verschwinden mit der aus dem Account entfernten Person", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );

    await deleteParticipant(pool, ACCOUNT_ID, clara.id);

    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    expect(assignments.some((a) => a.participantId === clara.id)).toBe(false);
  });

  it("laesst nach dem Entfernen des letzten Reiseleiters jemanden nachruecken", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    const max = await person(pool, "Max Gast", 2);
    // Clara fuehrt die Wien-Reise allein; Uwe faehrt dort nicht mit.
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      clara.id,
      "reiseleiter",
    );
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      max.id,
      "teilnehmer",
    );
    await removeTripParticipant(pool, ACCOUNT_ID, WIEN_ID, PARTICIPANT_ID);

    await deleteParticipant(pool, ACCOUNT_ID, clara.id);

    const assignments = await listTripParticipants(pool, ACCOUNT_ID);
    expect(zuordnungen(assignments, WIEN_ID)).toEqual([
      { tripId: WIEN_ID, participantId: max.id, role: "reiseleiter" },
    ]);
  });
});

describe("leadsAnyTrip (req-023)", () => {
  it("erkennt den Reiseleiter", async () => {
    const pool = createTestDb();

    expect(await leadsAnyTrip(pool, PARTICIPANT_ID)).toBe(true);
  });

  it("erkennt eine blosse Teilnehmerin nicht als Reiseleiterin", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );

    expect(await leadsAnyTrip(pool, clara.id)).toBe(false);
  });

  it("genuegt sich mit einer einzigen gefuehrten Reise", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      clara.id,
      "reiseleiter",
    );

    expect(await leadsAnyTrip(pool, clara.id)).toBe(true);
  });
});

describe("isInReleasedTrip (req-023)", () => {
  it("meldet nichts, solange die Reise auf „In Planung“ steht", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );

    expect(await isInReleasedTrip(pool, clara.id)).toBe(false);
  });

  it("meldet die Zuordnung, sobald die Reise freigegeben ist", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );
    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

    expect(await isInReleasedTrip(pool, clara.id)).toBe(true);
  });
});

describe("isInAnyTrip (req-023)", () => {
  it("erkennt, wer einer Reise des Accounts zugeordnet ist", async () => {
    const pool = createTestDb();
    const clara = await person(pool, "Clara Berger", 1);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      clara.id,
      "teilnehmer",
    );

    expect(await isInAnyTrip(pool, ACCOUNT_ID, clara.id)).toBe(true);
  });

  it("erkennt eine bloss erfasste Person nicht", async () => {
    const pool = createTestDb();
    const max = await person(pool, "Max Gast", 2);

    expect(await isInAnyTrip(pool, ACCOUNT_ID, max.id)).toBe(false);
  });

  it("sieht die Zuordnung eines fremden Accounts nicht (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);
    await assignTripParticipant(
      pool,
      fremd.accountId,
      fremd.tripId,
      fremd.participantId,
      "teilnehmer",
    );

    expect(await isInAnyTrip(pool, ACCOUNT_ID, fremd.participantId)).toBe(
      false,
    );
  });
});
