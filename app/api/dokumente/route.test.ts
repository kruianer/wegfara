// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { DOCUMENT_ERRORS } from "@/lib/documents/validate";
import type { TripDocument } from "@/lib/documents/types";

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
const { listDocuments } = await import("@/lib/db/documents");
const { listPois } = await import("@/lib/db/pois");
const { DOCUMENT_SUBDIR } = await import("@/lib/images/document-store");
const { DELETE, POST, PUT } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

let bildablage: string;

/** Die Dateien in der Dokumentenablage -- das "Bildverzeichnis betrachten". */
async function abgelegteDateien(): Promise<string[]> {
  try {
    return await readdir(path.join(bildablage, DOCUMENT_SUBDIR));
  } catch {
    return [];
  }
}

function hochladen(
  file: File,
  felder: Record<string, string> = { tripId: SUEDITALIEN_ID },
): Request {
  const body = new FormData();
  for (const [name, wert] of Object.entries(felder)) body.append(name, wert);
  body.append("datei", file);
  return new Request("https://dev.wegfara.com/api/dokumente", {
    method: "POST",
    body,
  });
}

function anfrage(method: "PUT" | "DELETE", body: unknown): Request {
  return new Request("https://dev.wegfara.com/api/dokumente", {
    method,
    body: JSON.stringify(body),
  });
}

/** Eine PDF-Datei mit zwei Seiten. */
function pdfDatei(name = "Flugticket.pdf"): File {
  const inhalt =
    "%PDF-1.4\n2 0 obj\n<< /Type /Pages /Count 2 >>\nendobj\n" +
    "3 0 obj\n<< /Type /Page >>\nendobj\n4 0 obj\n<< /Type /Page >>\nendobj\n%%EOF";
  return new File([inhalt], name, { type: "application/pdf" });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function abgelegtesDokument(): Promise<TripDocument> {
  const response = await POST(hochladen(pdfDatei()));
  const { document } = (await response.json()) as { document: TripDocument };
  return document;
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

describe("POST /api/dokumente (req-034)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST(hochladen(pdfDatei()))).status).toBe(401);
  });

  it("legt Datei und Datensatz an", async () => {
    await angemeldet();

    const response = await POST(hochladen(pdfDatei()));

    expect(response.status).toBe(201);
    const { document } = (await response.json()) as { document: TripDocument };
    expect(document).toMatchObject({
      tripId: SUEDITALIEN_ID,
      name: "Flugticket.pdf",
      contentType: "application/pdf",
      uploadedById: PARTICIPANT_ID,
    });
    expect(document.sizeBytes).toBeGreaterThan(0);
    // Die Seitenzahl steht beim Datensatz, damit sich blaettern laesst.
    expect(document.pageCount).toBe(2);
    expect(await abgelegteDateien()).toHaveLength(1);
    expect(await listDocuments(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("benennt die Datei in der Ablage nach eigener Kennung, nie nach dem hochgeladenen Namen", async () => {
    await angemeldet();

    await POST(hochladen(pdfDatei("../boese.pdf")));

    const [datei] = await abgelegteDateien();
    expect(datei).not.toContain("boese");
    expect(datei).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it("legt eine Datei mit 25 MB NICHT ab", async () => {
    await angemeldet();
    const gross = new File([new Uint8Array(25 * 1024 * 1024)], "gross.pdf", {
      type: "application/pdf",
    });

    const response = await POST(hochladen(gross));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe(
      DOCUMENT_ERRORS.size,
    );
    expect(await abgelegteDateien()).toEqual([]);
    expect(await listDocuments(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it('legt eine Datei mit der Endung ".zip" NICHT ab', async () => {
    await angemeldet();
    const zip = new File(["PK"], "unterlagen.zip", {
      type: "application/zip",
    });

    const response = await POST(hochladen(zip));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe(
      DOCUMENT_ERRORS.type,
    );
    expect(await abgelegteDateien()).toEqual([]);
    expect(await listDocuments(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("laesst keine Datei zurueck, wenn der Datensatz scheitert", async () => {
    await angemeldet();

    // Eine Reise, die es fuer diesen Account nicht gibt: die Datei ist da
    // schon geschrieben und muss wieder verschwinden (req-034).
    const response = await POST(
      hochladen(pdfDatei(), { tripId: randomUUID() }),
    );

    expect(response.status).toBe(404);
    expect(await abgelegteDateien()).toEqual([]);
  });

  it("verknuepft mit einem POI der Reise", async () => {
    await angemeldet();
    const poi = (await listPois(testDb.pool, ACCOUNT_ID)).find(
      (eintrag) => eintrag.tripId === SUEDITALIEN_ID,
    )!;

    const response = await POST(
      hochladen(pdfDatei(), { tripId: SUEDITALIEN_ID, poiId: poi.id }),
    );

    const { document } = (await response.json()) as { document: TripDocument };
    expect(document.poiId).toBe(poi.id);
  });
});

describe("PUT /api/dokumente (req-034: Name und Verknuepfung)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await PUT(anfrage("PUT", { id: "egal", name: "x" }))).status).toBe(
      401,
    );
  });

  it("aendert den Namen", async () => {
    await angemeldet();
    const dokument = await abgelegtesDokument();

    const response = await PUT(
      anfrage("PUT", { id: dokument.id, name: "Hinflug Neapel" }),
    );

    expect(response.status).toBe(200);
    const { document } = (await response.json()) as { document: TripDocument };
    expect(document.name).toBe("Hinflug Neapel");
  });

  it("verknuepft nachtraeglich mit einem POI der Reise", async () => {
    await angemeldet();
    const dokument = await abgelegtesDokument();
    const poi = (await listPois(testDb.pool, ACCOUNT_ID)).find(
      (eintrag) => eintrag.tripId === SUEDITALIEN_ID,
    )!;

    const response = await PUT(
      anfrage("PUT", {
        id: dokument.id,
        name: dokument.name,
        poiId: poi.id,
      }),
    );

    const { document } = (await response.json()) as { document: TripDocument };
    expect(document.poiId).toBe(poi.id);
  });

  it("weist einen leeren Namen ab", async () => {
    await angemeldet();
    const dokument = await abgelegtesDokument();

    expect(
      (await PUT(anfrage("PUT", { id: dokument.id, name: "  " }))).status,
    ).toBe(400);
  });
});

describe("DELETE /api/dokumente (req-034)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await DELETE(anfrage("DELETE", { id: "egal" }))).status).toBe(401);
  });

  it("entfernt Datensatz und Datei gemeinsam", async () => {
    await angemeldet();
    const dokument = await abgelegtesDokument();
    expect(await abgelegteDateien()).toHaveLength(1);

    const response = await DELETE(anfrage("DELETE", { id: dokument.id }));

    expect(response.status).toBe(200);
    expect(await listDocuments(testDb.pool, ACCOUNT_ID)).toEqual([]);
    expect(await abgelegteDateien()).toEqual([]);
  });

  it("entfernt nichts zu einem unbekannten Dokument", async () => {
    await angemeldet();

    expect((await DELETE(anfrage("DELETE", { id: randomUUID() }))).status).toBe(
      404,
    );
  });
});
