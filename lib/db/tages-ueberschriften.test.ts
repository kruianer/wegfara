// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { deleteTrip } from "./trips";
import {
  listTagesUeberschriften,
  setzeHandUeberschrift,
  speichereKiUeberschriften,
} from "./tages-ueberschriften";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const JETZT = new Date("2026-10-28T10:00:00Z");

let pool: ReturnType<typeof createTestDb>;

beforeEach(() => {
  pool = createTestDb();
});

function texte(liste: { datum: string; text: string; vonHand: boolean }[]) {
  return liste.map((u) => [u.datum, u.text, u.vonHand]);
}

describe("Ueberschriften der Reisetage (req-103)", () => {
  it("speichert, was die KI vorschlaegt", async () => {
    const liste = await speichereKiUeberschriften(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      [
        { datum: "2026-07-18", text: "Ankunft an der Küste" },
        { datum: "2026-07-19", text: "Ravello und Gärten" },
      ],
      JETZT,
    );
    expect(texte(liste!)).toEqual([
      ["2026-07-18", "Ankunft an der Küste", false],
      ["2026-07-19", "Ravello und Gärten", false],
    ]);
  });

  it("laesst eine von Hand geaenderte Ueberschrift beim erneuten Erzeugen stehen", async () => {
    await speichereKiUeberschriften(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      [
        { datum: "2026-07-18", text: "Ankunft" },
        { datum: "2026-07-19", text: "Ravello" },
      ],
      JETZT,
    );
    await setzeHandUeberschrift(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "2026-07-19",
      "Meine Überschrift",
      JETZT,
    );

    const liste = await speichereKiUeberschriften(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      [
        { datum: "2026-07-18", text: "Neu erzeugt" },
        { datum: "2026-07-19", text: "Überschrieben?" },
      ],
      JETZT,
    );
    expect(texte(liste!)).toEqual([
      ["2026-07-18", "Neu erzeugt", false],
      ["2026-07-19", "Meine Überschrift", true],
    ]);
  });

  it("nimmt mit einem leeren Text die Ueberschrift weg", async () => {
    await setzeHandUeberschrift(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "2026-07-19",
      "Weg damit",
      JETZT,
    );
    const liste = await setzeHandUeberschrift(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "2026-07-19",
      "",
      JETZT,
    );
    expect(liste).toEqual([]);
  });

  it("gilt fuer einen anderen Account nicht", async () => {
    await setzeHandUeberschrift(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "2026-07-19",
      "Meins",
      JETZT,
    );
    expect(
      await speichereKiUeberschriften(
        pool,
        randomUUID(),
        SUEDITALIEN_ID,
        [{ datum: "2026-07-19", text: "x" }],
        JETZT,
      ),
    ).toBeNull();
    expect(
      await listTagesUeberschriften(pool, randomUUID(), SUEDITALIEN_ID),
    ).toEqual([]);
  });

  it("verschwindet mit der Reise", async () => {
    await setzeHandUeberschrift(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "2026-07-19",
      "Meins",
      JETZT,
    );
    await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID);
    expect(await listTagesUeberschriften(pool, ACCOUNT_ID)).toEqual([]);
  });
});
