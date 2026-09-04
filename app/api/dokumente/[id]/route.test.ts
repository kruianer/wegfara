// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));

const { createSession } = await import("@/lib/db/sessions");
const { createDocument } = await import("@/lib/db/documents");
const { fileSystemDocumentStore } = await import(
  "@/lib/images/document-store"
);
const { GET } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date("2026-09-04T10:00:00.000Z");

let bildablage: string;

function anfrage(id: string) {
  return {
    request: new Request(`https://dev.wegfara.com/api/dokumente/${id}`),
    kontext: { params: Promise.resolve({ id }) },
  };
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Ein Dokument der eigenen Reise, Datei inklusive. */
async function eigenesDokument(mitDatei = true): Promise<string> {
  const fileName = `${randomUUID()}.pdf`;
  const result = await createDocument(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    {
      name: "Flugticket.pdf",
      fileName,
      contentType: "application/pdf",
      sizeBytes: 3,
      pageCount: 1,
      poiId: null,
      transferId: null,
      uploadedById: PARTICIPANT_ID,
    },
    NOW,
  );
  if (!result.ok) throw new Error("nicht angelegt");
  if (mitDatei) {
    await fileSystemDocumentStore().save(fileName, new Uint8Array([1, 2, 3]));
  }
  return result.document.id;
}

async function fremdesDokument(): Promise<string> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const id = randomUUID();
  const fileName = `${randomUUID()}.pdf`;
  await testDb.pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await testDb.pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  await testDb.pool.query(
    `insert into document (id, trip_id, name, file_name, content_type,
                           size_bytes, created_at)
     values ($1, $2, 'Fremd.pdf', $3, 'application/pdf', 3, $4)`,
    [id, tripId, fileName, NOW],
  );
  await fileSystemDocumentStore().save(fileName, new Uint8Array([9, 9, 9]));
  return id;
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  bildablage = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  process.env.IMAGE_DIR = bildablage;
});

afterEach(async () => {
  await rm(bildablage, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("GET /api/dokumente/[id] (req-034)", () => {
  it("verlangt eine Anmeldung", async () => {
    const id = await eigenesDokument();
    const { request, kontext } = anfrage(id);

    expect((await GET(request, kontext)).status).toBe(401);
  });

  it("liefert die Datei aus der Ablage", async () => {
    await angemeldet();
    const id = await eigenesDokument();
    const { request, kontext } = anfrage(id);

    const response = await GET(request, kontext);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      1, 2, 3,
    ]);
  });

  it("liefert kein Dokument eines anderen Accounts", async () => {
    await angemeldet();
    const id = await fremdesDokument();
    const { request, kontext } = anfrage(id);

    expect((await GET(request, kontext)).status).toBe(404);
  });

  it("liefert nichts, wenn zum Datensatz die Datei fehlt", async () => {
    await angemeldet();
    const id = await eigenesDokument(false);
    const { request, kontext } = anfrage(id);

    expect((await GET(request, kontext)).status).toBe(404);
  });
});
