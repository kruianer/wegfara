// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import {
  createChatNachricht,
  deleteChatNachrichten,
  listChatNachrichten,
} from "./chat-nachrichten";
import { deleteTrip } from "./trips";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

const NOW = new Date("2026-10-12T10:00:00.000Z");

type Pool = ReturnType<typeof createTestDb>;

let pool: Pool;

beforeEach(() => {
  pool = createTestDb();
});

/** Ein zweiter Account mit eigener Reise und eigener Unterhaltung. */
async function fremdeReiseMitUnterhaltung(): Promise<string> {
  const accountId = randomUUID();
  const tripId = randomUUID();
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
    `insert into chat_nachricht (id, trip_id, rolle, text, modell, created_at)
     values ($1, $2, 'ich', 'Fremde Frage', null, $3)`,
    [randomUUID(), tripId, NOW],
  );
  return tripId;
}

describe("Verlauf einer Reise (req-081)", () => {
  it("beginnt leer", async () => {
    expect(await listChatNachrichten(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toEqual(
      [],
    );
  });

  it("legt eine Frage ab und gibt sie mit Kennung und Zeit zurueck", async () => {
    const frage = await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ich", text: "Was kostet der Tag?", modell: null },
      NOW,
    );

    expect(frage).toMatchObject({
      tripId: SUEDITALIEN_ID,
      rolle: "ich",
      text: "Was kostet der Tag?",
      modell: null,
      createdAt: NOW.toISOString(),
    });
    expect(frage?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("merkt sich zu einer Antwort, von welchem Modell sie kam", async () => {
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ki", text: "Gern.", modell: "claude-opus-5" },
      NOW,
    );

    const verlauf = await listChatNachrichten(pool, ACCOUNT_ID, SUEDITALIEN_ID);
    expect(verlauf[0].modell).toBe("claude-opus-5");
  });

  it("gibt Fragen und Antworten in zeitlicher Folge", async () => {
    const zeiten = [
      new Date("2026-10-12T10:00:00.000Z"),
      new Date("2026-10-12T10:00:05.000Z"),
      new Date("2026-10-12T10:01:00.000Z"),
    ];
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ich", text: "Erste Frage", modell: null },
      zeiten[0],
    );
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ki", text: "Erste Antwort", modell: "claude-sonnet-5" },
      zeiten[1],
    );
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ich", text: "Zweite Frage", modell: null },
      zeiten[2],
    );

    const verlauf = await listChatNachrichten(pool, ACCOUNT_ID, SUEDITALIEN_ID);
    expect(verlauf.map((nachricht) => nachricht.text)).toEqual([
      "Erste Frage",
      "Erste Antwort",
      "Zweite Frage",
    ]);
  });

  /** Der Verlauf gehoert der Reise: ein Wechsel zeigt die ihre (req-081). */
  it("haelt die Unterhaltungen zweier Reisen auseinander", async () => {
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ich", text: "Zur Amalfikueste", modell: null },
      NOW,
    );
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      { rolle: "ich", text: "Nach Wien", modell: null },
      NOW,
    );

    expect(
      (await listChatNachrichten(pool, ACCOUNT_ID, SUEDITALIEN_ID)).map(
        (nachricht) => nachricht.text,
      ),
    ).toEqual(["Zur Amalfikueste"]);
    expect(
      (await listChatNachrichten(pool, ACCOUNT_ID, WIEN_ID)).map(
        (nachricht) => nachricht.text,
      ),
    ).toEqual(["Nach Wien"]);
  });

  it("verwirft die Unterhaltung und laesst die der anderen Reise stehen", async () => {
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ich", text: "Weg damit", modell: null },
      NOW,
    );
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      { rolle: "ich", text: "Bleibt", modell: null },
      NOW,
    );

    await deleteChatNachrichten(pool, ACCOUNT_ID, SUEDITALIEN_ID);

    expect(await listChatNachrichten(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toEqual(
      [],
    );
    expect(await listChatNachrichten(pool, ACCOUNT_ID, WIEN_ID)).toHaveLength(
      1,
    );
  });

  it("legt die Quellen einer Antwort in ihrer Reihenfolge ab (req-092)", async () => {
    const quellen = [
      { url: "https://b.example/", titel: "B" },
      { url: "https://a.example/", titel: "A" },
    ];
    const antwort = await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ki", text: "Gern.", modell: "claude-opus-5", quellen },
      NOW,
    );

    expect(antwort?.quellen).toEqual(quellen);
    const [gelesen] = await listChatNachrichten(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(gelesen.quellen).toEqual(quellen);
    expect(gelesen.sucheFehler).toBeNull();
  });

  it("gibt einer Nachricht ohne Suche keine Quellen (req-092)", async () => {
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      { rolle: "ich", text: "Hallo", modell: null },
      NOW,
    );

    const [gelesen] = await listChatNachrichten(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(gelesen.quellen).toEqual([]);
  });

  it("verwirft die Quellen mit der Unterhaltung (req-092)", async () => {
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      {
        rolle: "ki",
        text: "Gern.",
        modell: "claude-opus-5",
        quellen: [{ url: "https://a.example/", titel: "A" }],
      },
      NOW,
    );

    await deleteChatNachrichten(pool, ACCOUNT_ID, SUEDITALIEN_ID);

    const { rows } = await pool.query("select * from chat_quelle");
    expect(rows).toEqual([]);
  });

  /** Mit der Reise verschwindet ihre Unterhaltung -- sie handelt von ihr. */
  it("verschwindet mit der Reise", async () => {
    await createChatNachricht(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      { rolle: "ich", text: "Nach Wien", modell: null },
      NOW,
    );

    await deleteTrip(pool, ACCOUNT_ID, WIEN_ID);

    const { rows } = await pool.query(
      "select id from chat_nachricht where trip_id = $1",
      [WIEN_ID],
    );
    expect(rows).toEqual([]);
  });
});

/**
 * Wer eine Reise nicht sieht, sieht ihre Unterhaltung nicht (req-023,
 * security.md). Die Kennung der Reise kommt aus der Anfrage -- geprueft wird
 * sie deshalb gegen den Account aus der Anmeldung (req-024).
 */
describe("Mandantentrennung des Verlaufs (req-081)", () => {
  it("findet die Unterhaltung einer fremden Reise nicht", async () => {
    const fremd = await fremdeReiseMitUnterhaltung();

    expect(await listChatNachrichten(pool, ACCOUNT_ID, fremd)).toEqual([]);
  });

  it("legt in einer fremden Reise nichts ab", async () => {
    const fremd = await fremdeReiseMitUnterhaltung();

    const abgelegt = await createChatNachricht(
      pool,
      ACCOUNT_ID,
      fremd,
      { rolle: "ich", text: "Fremd", modell: null },
      NOW,
    );

    expect(abgelegt).toBeNull();
    const { rows } = await pool.query(
      "select id from chat_nachricht where trip_id = $1",
      [fremd],
    );
    expect(rows).toHaveLength(1);
  });

  it("verwirft die Unterhaltung einer fremden Reise nicht", async () => {
    const fremd = await fremdeReiseMitUnterhaltung();

    await deleteChatNachrichten(pool, ACCOUNT_ID, fremd);

    const { rows } = await pool.query(
      "select id from chat_nachricht where trip_id = $1",
      [fremd],
    );
    expect(rows).toHaveLength(1);
  });

  it("legt zu einer Reise, die es nicht gibt, nichts ab", async () => {
    expect(
      await createChatNachricht(
        pool,
        ACCOUNT_ID,
        randomUUID(),
        { rolle: "ich", text: "Ins Leere", modell: null },
        NOW,
      ),
    ).toBeNull();
  });
});
