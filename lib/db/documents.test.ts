// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import {
  createDocument,
  deleteDocument,
  findDocumentFile,
  listDocumentFileNamesOfTrip,
  listDocumentFileRefs,
  listDocuments,
  updateDocument,
  type DocumentFields,
} from "./documents";
import { listPois } from "./pois";
import { listTransfers } from "./transfers";
import { deleteParticipant } from "./participants";
import { deleteTrip } from "./trips";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

const NOW = new Date("2026-09-04T10:00:00.000Z");
const SPAETER = new Date("2026-09-04T12:00:00.000Z");

type Pool = ReturnType<typeof createTestDb>;

function flugticket(overrides: Partial<DocumentFields> = {}): DocumentFields {
  return {
    name: "Flugticket.pdf",
    fileName: `${randomUUID()}.pdf`,
    contentType: "application/pdf",
    sizeBytes: 421_888,
    pageCount: 2,
    poiId: null,
    transferId: null,
    uploadedById: PARTICIPANT_ID,
    ...overrides,
  };
}

/** Ein Account mit einer eigenen Reise -- fuer die Mandantentrennung. */
async function fremdeReise(pool: Pool): Promise<string> {
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
  return tripId;
}

describe("createDocument (req-034)", () => {
  it("legt den Datensatz zur Datei an", async () => {
    const pool = createTestDb();

    const result = await createDocument(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      flugticket(),
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).toMatchObject({
      tripId: SUEDITALIEN_ID,
      name: "Flugticket.pdf",
      contentType: "application/pdf",
      sizeBytes: 421_888,
      pageCount: 2,
      poiId: null,
      transferId: null,
      uploadedById: PARTICIPANT_ID,
    });
    expect(result.document.createdAt).toBe(NOW.toISOString());
  });

  it("legt nichts an einer Reise eines anderen Accounts an", async () => {
    const pool = createTestDb();
    const fremd = await fremdeReise(pool);

    const result = await createDocument(
      pool,
      ACCOUNT_ID,
      fremd,
      flugticket(),
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "unknown" });
  });

  it("verknuepft mit einem POI derselben Reise", async () => {
    const pool = createTestDb();
    const poi = (await listPois(pool, ACCOUNT_ID)).find(
      (eintrag) => eintrag.tripId === SUEDITALIEN_ID,
    )!;

    const result = await createDocument(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      flugticket({ poiId: poi.id }),
      NOW,
    );

    expect(result.ok && result.document.poiId).toBe(poi.id);
  });

  it("verknuepft nicht mit einem POI einer anderen Reise", async () => {
    const pool = createTestDb();
    const fremderPoi = (await listPois(pool, ACCOUNT_ID)).find(
      (eintrag) => eintrag.tripId !== SUEDITALIEN_ID,
    )!;

    const result = await createDocument(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      flugticket({ poiId: fremderPoi.id }),
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "notInTrip" });
  });

  it("verknuepft nie mit POI und Transfer zugleich", async () => {
    const pool = createTestDb();
    const poi = (await listPois(pool, ACCOUNT_ID)).find(
      (eintrag) => eintrag.tripId === SUEDITALIEN_ID,
    )!;
    const transfer = (await listTransfers(pool, ACCOUNT_ID)).find(
      (eintrag) => eintrag.tripId === SUEDITALIEN_ID,
    )!;

    const result = await createDocument(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      flugticket({ poiId: poi.id, transferId: transfer.id }),
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "notInTrip" });
  });
});

describe("listDocuments (req-034)", () => {
  it("liefert die Dokumente des Accounts, das neueste zuerst", async () => {
    const pool = createTestDb();
    await createDocument(pool, ACCOUNT_ID, SUEDITALIEN_ID, flugticket(), NOW);
    await createDocument(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      flugticket({ name: "Hotel.pdf" }),
      SPAETER,
    );

    expect(
      (await listDocuments(pool, ACCOUNT_ID)).map((doc) => doc.name),
    ).toEqual(["Hotel.pdf", "Flugticket.pdf"]);
  });

  it("liefert keine Dokumente eines anderen Accounts", async () => {
    const pool = createTestDb();
    const fremd = await fremdeReise(pool);
    await pool.query(
      `insert into document (id, trip_id, name, file_name, content_type,
                             size_bytes, created_at)
       values ($1, $2, 'Fremd.pdf', 'fremd.pdf', 'application/pdf', 100, $3)`,
      [randomUUID(), fremd, NOW],
    );

    expect(await listDocuments(pool, ACCOUNT_ID)).toEqual([]);
  });
});

describe("updateDocument (req-034: Name und Verknuepfung)", () => {
  it("aendert den Namen", async () => {
    const pool = createTestDb();
    const angelegt = await createDocument(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      flugticket(),
      NOW,
    );
    if (!angelegt.ok) throw new Error("nicht angelegt");

    const result = await updateDocument(
      pool,
      ACCOUNT_ID,
      angelegt.document.id,
      { name: "Hinflug Neapel", poiId: null, transferId: null },
    );

    expect(result.ok && result.document.name).toBe("Hinflug Neapel");
  });

  it("aendert ein Dokument eines anderen Accounts nicht", async () => {
    const pool = createTestDb();
    const fremd = await fremdeReise(pool);
    const id = randomUUID();
    await pool.query(
      `insert into document (id, trip_id, name, file_name, content_type,
                             size_bytes, created_at)
       values ($1, $2, 'Fremd.pdf', 'fremd.pdf', 'application/pdf', 100, $3)`,
      [id, fremd, NOW],
    );

    expect(
      await updateDocument(pool, ACCOUNT_ID, id, {
        name: "Meins",
        poiId: null,
        transferId: null,
      }),
    ).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("deleteDocument (req-034)", () => {
  it("entfernt den Datensatz und nennt seine Datei", async () => {
    const pool = createTestDb();
    const fields = flugticket();
    const angelegt = await createDocument(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      fields,
      NOW,
    );
    if (!angelegt.ok) throw new Error("nicht angelegt");

    const entfernt = await deleteDocument(
      pool,
      ACCOUNT_ID,
      angelegt.document.id,
    );

    expect(entfernt).toEqual({ fileName: fields.fileName });
    expect(await listDocuments(pool, ACCOUNT_ID)).toEqual([]);
  });

  it("entfernt kein Dokument eines anderen Accounts", async () => {
    const pool = createTestDb();
    const fremd = await fremdeReise(pool);
    const id = randomUUID();
    await pool.query(
      `insert into document (id, trip_id, name, file_name, content_type,
                             size_bytes, created_at)
       values ($1, $2, 'Fremd.pdf', 'fremd.pdf', 'application/pdf', 100, $3)`,
      [id, fremd, NOW],
    );

    expect(await deleteDocument(pool, ACCOUNT_ID, id)).toBeNull();
  });
});

describe("findDocumentFile (req-034: nur fuer den eigenen Account)", () => {
  it("liefert Datei und Art", async () => {
    const pool = createTestDb();
    const fields = flugticket();
    const angelegt = await createDocument(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      fields,
      NOW,
    );
    if (!angelegt.ok) throw new Error("nicht angelegt");

    expect(
      await findDocumentFile(pool, ACCOUNT_ID, angelegt.document.id),
    ).toEqual({
      fileName: fields.fileName,
      contentType: "application/pdf",
      name: "Flugticket.pdf",
    });
  });

  it("liefert nichts fuer ein Dokument eines anderen Accounts", async () => {
    const pool = createTestDb();
    const fremd = await fremdeReise(pool);
    const id = randomUUID();
    await pool.query(
      `insert into document (id, trip_id, name, file_name, content_type,
                             size_bytes, created_at)
       values ($1, $2, 'Fremd.pdf', 'fremd.pdf', 'application/pdf', 100, $3)`,
      [id, fremd, NOW],
    );

    expect(await findDocumentFile(pool, ACCOUNT_ID, id)).toBeNull();
  });
});

describe("Dokumente und die Reise (req-034)", () => {
  it("verschwinden mit ihrer Reise -- der Aufrufer kennt vorher ihre Dateien", async () => {
    const pool = createTestDb();
    const fields = flugticket();
    await createDocument(pool, ACCOUNT_ID, SUEDITALIEN_ID, fields, NOW);

    const dateien = await listDocumentFileNamesOfTrip(pool, SUEDITALIEN_ID);
    await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID);

    expect(dateien).toEqual([fields.fileName]);
    expect(await listDocuments(pool, ACCOUNT_ID)).toEqual([]);
  });

  it("bleiben, wenn die Person geht, die sie abgelegt hat", async () => {
    const pool = createTestDb();
    const angelegt = await createDocument(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      flugticket(),
      NOW,
    );
    if (!angelegt.ok) throw new Error("nicht angelegt");

    await deleteParticipant(pool, ACCOUNT_ID, PARTICIPANT_ID);

    const [document] = await listDocuments(pool, ACCOUNT_ID);
    expect(document.name).toBe("Flugticket.pdf");
    expect(document.uploadedById).toBeNull();
  });
});

describe("listDocumentFileRefs (req-034, taegliche Pruefung)", () => {
  it("nennt jeden Datensatz mit seiner Datei", async () => {
    const pool = createTestDb();
    const fields = flugticket();
    await createDocument(pool, ACCOUNT_ID, SUEDITALIEN_ID, fields, NOW);

    expect(await listDocumentFileRefs(pool)).toEqual([
      expect.objectContaining({
        name: "Flugticket.pdf",
        fileName: fields.fileName,
      }),
    ]);
  });
});
