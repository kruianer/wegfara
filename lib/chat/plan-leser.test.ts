// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { ACCOUNT_ID, PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
import type { PlanAuskunft } from "../ai/chat-client";
import { createPlanLeser } from "./plan-leser";

/**
 * Die lesenden Werkzeuge des Chats (req-093) gegen dieselbe Datenbank wie die
 * Anwendung. Geprueft wird, was das Modell zu sehen bekommt -- und vor allem,
 * was nicht.
 */

const HERBST_ID = "93a1b2c3-0001-4a93-8b93-000000000001";
const ZWEITE_ID = "93a1b2c3-0002-4a93-8b93-000000000002";
const FREMDE_ID = "93a1b2c3-0003-4a93-8b93-000000000003";
const FREMDER_ACCOUNT = "93a1b2c3-0004-4a93-8b93-000000000004";
const CAFE_ID = "93a1b2c3-0005-4a93-8b93-000000000005";
const MITREISENDE_ID = "93a1b2c3-0006-4a93-8b93-000000000006";

/** Ein Langtext, der jedes Kontextfenster sprengen wuerde, wenn er mitginge. */
const LANGTEXT = `Das Café Uhl ist ein Wiener Kaffeehaus. ${"Sehr lang. ".repeat(500)}ENDE-DES-LANGTEXTS`;

let db: ReturnType<typeof createTestDb>;

async function reise(
  id: string,
  titel: string,
  von: string,
  bis: string,
  account = ACCOUNT_ID,
) {
  await db.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, $3, $4, $5, 'Wien', 48.2, 16.37)`,
    [id, account, titel, von, bis],
  );
}

let programmpunktNummer = 0;
async function programmpunkt(
  tripId: string,
  titel: string,
  von: string,
  bis: string,
  poiId: string | null = null,
) {
  programmpunktNummer += 1;
  await db.query(
    `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng, poi_id)
     values ($1, $2, 'restaurant', $3, 'kurz', 'Langtext des Programmpunkts', $4, $5, 48.2, 16.37, $6)`,
    [
      `93a1b2c3-1${String(programmpunktNummer).padStart(3, "0")}-4a93-8b93-000000000000`,
      tripId,
      titel,
      von,
      bis,
      poiId,
    ],
  );
}

async function inhalt(auskunft: Promise<PlanAuskunft>) {
  const ergebnis = await auskunft;
  if (!ergebnis.ok) throw new Error(`kein Inhalt: ${ergebnis.hinweis}`);
  return ergebnis.inhalt;
}

beforeEach(async () => {
  db = createTestDb();
  programmpunktNummer = 0;
  // Montag, 2. November 2026, bis Mittwoch.
  await reise(HERBST_ID, "Wien im Herbst", "2026-11-02", "2026-11-04");
  await reise(ZWEITE_ID, "Zweite Reise", "2026-11-02", "2026-11-03");
  await db.query(
    `insert into account (id, name, email) values ($1, 'Fremder Account', 'fremd@example.com')`,
    [FREMDER_ACCOUNT],
  );
  await reise(
    FREMDE_ID,
    "Fremde Reise",
    "2026-11-02",
    "2026-11-03",
    FREMDER_ACCOUNT,
  );

  await db.query(
    `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status, short_text, long_text, kosten_cent)
     values ($1, $2, 1, 'Café Uhl', 'Wien', 'restaurant', 48.2, 16.37, 'gesetzt', 'Kaffeehaus mit Kuchen', $3, 1250)`,
    [CAFE_ID, HERBST_ID, LANGTEXT],
  );
  await db.query(
    `insert into poi_photo (id, poi_id, position, file_name, created_at)
     values ('93a1b2c3-0007-4a93-8b93-000000000007', $1, 0, 'cafe-uhl-geheim.jpg', now())`,
    [CAFE_ID],
  );

  // Drei Programmpunkte am Montag -- absichtlich nicht in zeitlicher Folge
  // angelegt -- und einer am Dienstag.
  await programmpunkt(
    HERBST_ID,
    "Abendessen im Figlmüller",
    "2026-11-02 19:00",
    "2026-11-02 21:00",
  );
  await programmpunkt(
    HERBST_ID,
    "Frühstück im Café Uhl",
    "2026-11-02 08:30",
    "2026-11-02 09:30",
    CAFE_ID,
  );
  await programmpunkt(
    HERBST_ID,
    "Albertina",
    "2026-11-02 11:00",
    "2026-11-02 13:00",
  );
  await programmpunkt(
    HERBST_ID,
    "Prater",
    "2026-11-03 10:00",
    "2026-11-03 12:00",
  );
  // Dieselbe Zeit in den anderen Reisen.
  await programmpunkt(
    ZWEITE_ID,
    "Programmpunkt der zweiten Reise",
    "2026-11-02 10:00",
    "2026-11-02 11:00",
  );
  await programmpunkt(
    FREMDE_ID,
    "Programmpunkt eines fremden Accounts",
    "2026-11-02 10:00",
    "2026-11-02 11:00",
  );

  // Zwei Teilnehmer: der Betreiber und eine Mitreisende mit Name und Adresse.
  await db.query(
    `insert into participant (id, account_id, name, email, created_at)
     values ($1, $2, 'Mitreisende Erika', 'erika@example.com', now())`,
    [MITREISENDE_ID, ACCOUNT_ID],
  );
  for (const participant of [PARTICIPANT_ID, MITREISENDE_ID]) {
    await db.query(
      `insert into trip_participant (trip_id, participant_id, role) values ($1, $2, 'teilnehmer')`,
      [HERBST_ID, participant],
    );
  }
});

function leser(tripId = HERBST_ID) {
  return createPlanLeser(db, ACCOUNT_ID, tripId);
}

describe("Tagesplan lesen (req-093)", () => {
  it("nennt die drei Programmpunkte des Montags in zeitlicher Folge", async () => {
    const tag = await inhalt(
      leser().lies("tagesplan_lesen", { datum: "2026-11-02" }),
    );

    expect(tag.wochentag).toBe("Montag");
    const punkte = tag.programmpunkte as { titel: string; von: string }[];
    expect(punkte.map((punkt) => [punkt.von, punkt.titel])).toEqual([
      ["08:30", "Frühstück im Café Uhl"],
      ["11:00", "Albertina"],
      ["19:00", "Abendessen im Figlmüller"],
    ]);
  });

  it("weist einen Tag ausserhalb der Reise mit einem Hinweis an das Modell ab", async () => {
    const auskunft = await leser().lies("tagesplan_lesen", {
      datum: "2026-12-24",
    });

    expect(auskunft.ok).toBe(false);
  });

  it("gibt keinen Langtext und keine Kennung eines Programmpunkts heraus", async () => {
    const tag = await inhalt(
      leser().lies("tagesplan_lesen", { datum: "2026-11-02" }),
    );

    const text = JSON.stringify(tag);
    expect(text).not.toContain("Langtext des Programmpunkts");
    expect(text).not.toMatch(/93a1b2c3-/);
  });
});

describe("Reise lesen (req-093)", () => {
  it("nennt Titel, Zeitraum und die Reisetage mit Wochentag", async () => {
    const reiseInhalt = await inhalt(leser().lies("reise_lesen", {}));

    expect(reiseInhalt).toMatchObject({
      titel: "Wien im Herbst",
      von: "2026-11-02",
      bis: "2026-11-04",
      hauptort: "Wien",
    });
    expect(reiseInhalt.reisetage).toEqual([
      { tag: 1, datum: "2026-11-02", wochentag: "Montag" },
      { tag: 2, datum: "2026-11-03", wochentag: "Dienstag" },
      { tag: 3, datum: "2026-11-04", wochentag: "Mittwoch" },
    ]);
  });

  it("nennt die Zahl der Teilnehmer, aber weder Namen noch E-Mail-Adressen", async () => {
    const reiseInhalt = await inhalt(leser().lies("reise_lesen", {}));

    expect(reiseInhalt.teilnehmerzahl).toBe(2);
    const text = JSON.stringify(reiseInhalt);
    expect(text).not.toContain("Erika");
    expect(text).not.toContain("erika@example.com");
    expect(text).not.toContain("uwe@kremmel.org");
    expect(text).not.toContain(PARTICIPANT_ID);
  });
});

describe("POI-Sammlung lesen (req-093)", () => {
  it("nennt das Café Uhl aus der Sammlung, samt dem Tag, an dem es eingeplant ist", async () => {
    const sammlung = await inhalt(leser().lies("pois_lesen", {}));

    expect(sammlung.pois).toEqual([
      expect.objectContaining({
        name: "Café Uhl",
        typ: "Restaurant",
        // Gespeichert ist "gesetzt"; der Chat nennt den Namen (req-100).
        status: "Fix",
        kurztext: "Kaffeehaus mit Kuchen",
        eingeplantAm: ["2026-11-02"],
      }),
    ]);
  });

  it("gibt den Langtext nicht heraus, auch keine Fotos und keine Kennung", async () => {
    const sammlung = await inhalt(leser().lies("pois_lesen", {}));

    const text = JSON.stringify(sammlung);
    expect(text).not.toContain("ENDE-DES-LANGTEXTS");
    expect(text).not.toContain("Sehr lang.");
    expect(text).not.toContain("cafe-uhl-geheim.jpg");
    expect(text).not.toContain(CAFE_ID);
  });
});

describe("Kosten lesen (req-093)", () => {
  it("beruht beim Montag auf der Kostenaufstellung der Reise", async () => {
    await db.query(
      `insert into kostenzeile (id, trip_id, bezeichnung, preis_cent, created_at)
       values ('93a1b2c3-0008-4a93-8b93-000000000008', $1, 'Parkgebühr', 900, now())`,
      [HERBST_ID],
    );

    const kosten = await inhalt(
      leser().lies("kosten_lesen", { datum: "2026-11-02" }),
    );

    // Nur der Montag, und dort traegt allein das Café einen Preis: 12,50 €
    // je Person, mal zwei Teilnehmer. Die manuelle Parkgebuehr liegt an
    // keinem Tag und gehoert deshalb nicht zum Montag.
    const zeilen = kosten.zeilen as {
      bezeichnung: string;
      gesamt: string | null;
    }[];
    expect(zeilen.map((zeile) => zeile.bezeichnung)).toEqual([
      "Café Uhl",
      "Albertina",
      "Abendessen im Figlmüller",
    ]);
    expect(zeilen[0]).toMatchObject({
      preisJePerson: "12,50 €",
      anzahl: 2,
      gesamt: "25,00 €",
    });
    expect(kosten.summeGesamt).toBe("25,00 €");
    expect(kosten.summeJePerson).toBe("12,50 €");
  });

  it("nennt ohne Datum die ganze Aufstellung samt manueller Zeilen", async () => {
    await db.query(
      `insert into kostenzeile (id, trip_id, bezeichnung, preis_cent, created_at)
       values ('93a1b2c3-0008-4a93-8b93-000000000008', $1, 'Parkgebühr', 900, now())`,
      [HERBST_ID],
    );

    const kosten = await inhalt(leser().lies("kosten_lesen", {}));

    expect(
      (kosten.zeilen as { bezeichnung: string }[]).map((z) => z.bezeichnung),
    ).toContain("Parkgebühr");
    // 25,00 € fuer das Café und 9,00 € mal zwei fuer das Parken.
    expect(kosten.summeGesamt).toBe("43,00 €");
  });
});

/**
 * Der Mandant kommt aus der Anmeldung, die Reise vom Server (req-024,
 * req-093) -- nie aus dem, was das Modell sagt.
 */
describe("Nur die geoeffnete Reise (req-093)", () => {
  it("nennt im Chat der einen Reise nur deren Programmpunkte, nicht die der zweiten", async () => {
    const herbst = await inhalt(
      leser(HERBST_ID).lies("tagesplan_lesen", { datum: "2026-11-02" }),
    );
    const zweite = await inhalt(
      leser(ZWEITE_ID).lies("tagesplan_lesen", { datum: "2026-11-02" }),
    );

    expect(JSON.stringify(herbst)).not.toContain("zweiten Reise");
    expect(JSON.stringify(zweite)).not.toContain("Albertina");
    expect(
      (zweite.programmpunkte as { titel: string }[]).map((p) => p.titel),
    ).toEqual(["Programmpunkt der zweiten Reise"]);
  });

  it("ignoriert eine Reisekennung, die das Modell nennt, und liest die geoeffnete", async () => {
    for (const fremd of [ZWEITE_ID, FREMDE_ID]) {
      const eingabe = {
        datum: "2026-11-02",
        tripId: fremd,
        trip_id: fremd,
        reise: fremd,
        accountId: FREMDER_ACCOUNT,
      };
      for (const werkzeug of [
        "reise_lesen",
        "pois_lesen",
        "tagesplan_lesen",
        "kosten_lesen",
      ] as const) {
        const text = JSON.stringify(await leser().lies(werkzeug, eingabe));
        expect(text).not.toContain("zweiten Reise");
        expect(text).not.toContain("fremden Accounts");
        expect(text).not.toContain("Fremde Reise");
      }
      const tag = await inhalt(leser().lies("tagesplan_lesen", eingabe));
      expect(
        (tag.programmpunkte as { titel: string }[]).map((p) => p.titel),
      ).toContain("Albertina");
    }
  });

  it("liest eine Reise eines fremden Accounts nicht, auch wenn der Server sie naennte", async () => {
    const auskunft = createPlanLeser(db, ACCOUNT_ID, FREMDE_ID).lies(
      "reise_lesen",
      {},
    );

    await expect(auskunft).rejects.toThrow();
  });

  /**
   * Die Einschraenkung auf die Reise liegt in der Abfrage, nicht erst beim
   * Aufrufer (req-093, Constraints): keine Abfrage des Lesers holt Zeilen
   * einer anderen Reise auch nur in den Speicher.
   */
  it("schraenkt jede Abfrage selbst auf die geoeffnete Reise ein", async () => {
    const abfragen: { sql: string; werte: unknown[] }[] = [];
    const mitgeschrieben = {
      query: (sql: string, werte: unknown[] = []) => {
        abfragen.push({ sql, werte });
        return db.query(sql, werte);
      },
    } as unknown as typeof db;
    const leserMitProtokoll = createPlanLeser(
      mitgeschrieben,
      ACCOUNT_ID,
      HERBST_ID,
    );

    for (const werkzeug of [
      "reise_lesen",
      "pois_lesen",
      "tagesplan_lesen",
      "kosten_lesen",
    ] as const) {
      await leserMitProtokoll.lies(werkzeug, { datum: "2026-11-02" });
    }

    const reiseAbfragen = abfragen.filter(({ sql }) =>
      /from (poi|poi_photo|activity|transfer|kostenzeile|trip_participant) /.test(
        sql,
      ),
    );
    expect(reiseAbfragen.length).toBeGreaterThan(0);
    for (const { sql, werte } of reiseAbfragen) {
      expect(sql).toMatch(/\.trip_id = \$2/);
      expect(werte).toEqual([ACCOUNT_ID, HERBST_ID]);
    }
  });
});
