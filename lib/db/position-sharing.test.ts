// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { saveTripPosition, listTripPositions } from "./trip-positions";
import {
  isPositionSharingEnabled,
  listEnabledTripIds,
  setPositionSharing,
} from "./position-sharing";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const ANDERE_REISE_ID = "b7a3c1a0-4e7a-4c9e-8f8d-1a2b3c4d5e6f";

const NOW = new Date("2026-07-20T14:09:00.000Z");

type Pool = ReturnType<typeof createTestDb>;

let pool: Pool;

beforeEach(async () => {
  pool = createTestDb();
  await pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Andere Reise', '2026-08-01', '2026-08-05', 'Rom', 41.9, 12.5)`,
    [ANDERE_REISE_ID, ACCOUNT_ID],
  );
});

describe("position_sharing (req-050)", () => {
  it("ist zunaechst nicht eingeschaltet", async () => {
    expect(
      await isPositionSharingEnabled(
        pool,
        ACCOUNT_ID,
        SUEDITALIEN_ID,
        PARTICIPANT_ID,
      ),
    ).toBe(false);
  });

  it("schaltet die Freigabe ein", async () => {
    const ok = await setPositionSharing(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      NOW,
    );

    expect(ok).toBe(true);
    expect(
      await isPositionSharingEnabled(
        pool,
        ACCOUNT_ID,
        SUEDITALIEN_ID,
        PARTICIPANT_ID,
      ),
    ).toBe(true);
  });

  it("bleibt beim zweiten Einschalten unveraendert (kein Fehler)", async () => {
    await setPositionSharing(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      NOW,
    );

    await expect(
      setPositionSharing(
        pool,
        ACCOUNT_ID,
        SUEDITALIEN_ID,
        PARTICIPANT_ID,
        true,
        NOW,
      ),
    ).resolves.toBe(true);
  });

  it("schaltet die Freigabe wieder aus", async () => {
    await setPositionSharing(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      NOW,
    );

    await setPositionSharing(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      false,
      NOW,
    );

    expect(
      await isPositionSharingEnabled(
        pool,
        ACCOUNT_ID,
        SUEDITALIEN_ID,
        PARTICIPANT_ID,
      ),
    ).toBe(false);
  });

  it("loescht beim Ausschalten die zuletzt geteilte Position sofort", async () => {
    await setPositionSharing(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      NOW,
    );
    await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896 },
      NOW,
    );

    await setPositionSharing(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      false,
      NOW,
    );

    expect(await listTripPositions(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toEqual(
      [],
    );
  });

  it("schaltet nichts frei fuer eine Reise eines fremden Accounts", async () => {
    const fremderAccount = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [fremderAccount, "Andere Person", "andere@example.com"],
    );

    const ok = await setPositionSharing(
      pool,
      fremderAccount,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      NOW,
    );

    expect(ok).toBe(false);
    expect(
      await isPositionSharingEnabled(
        pool,
        ACCOUNT_ID,
        SUEDITALIEN_ID,
        PARTICIPANT_ID,
      ),
    ).toBe(false);
  });

  it("listet nur die Reisen, fuer die die Person eingeschaltet hat", async () => {
    await setPositionSharing(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      NOW,
    );

    expect(await listEnabledTripIds(pool, ACCOUNT_ID, PARTICIPANT_ID)).toEqual([
      SUEDITALIEN_ID,
    ]);
  });

  it("haelt die Freigaben zweier Reisen auseinander", async () => {
    await setPositionSharing(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      true,
      NOW,
    );

    expect(
      await isPositionSharingEnabled(
        pool,
        ACCOUNT_ID,
        ANDERE_REISE_ID,
        PARTICIPANT_ID,
      ),
    ).toBe(false);
  });
});
