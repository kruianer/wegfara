// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));

const { createDocument, listDocuments } = await import("@/lib/db/documents");
const { fileSystemDocumentStore } = await import("@/lib/images/document-store");
const {
  DOCUMENT_AUDIT_FIRST_RUN_MS,
  DOCUMENT_AUDIT_INTERVAL_MS,
  auditDocumentsOnce,
  startDocumentAudit,
} = await import("./daily-audit");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date("2026-09-04T10:00:00.000Z");

describe("startDocumentAudit (req-034: taeglich prueft ein Lauf)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("laeuft kurz nach dem Start und danach taeglich", async () => {
    const run = vi.fn(async () => {});

    startDocumentAudit(run);

    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DOCUMENT_AUDIT_FIRST_RUN_MS);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DOCUMENT_AUDIT_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(DOCUMENT_AUDIT_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("laeuft einmal am Tag, nicht oefter", async () => {
    const run = vi.fn(async () => {});

    startDocumentAudit(run);
    await vi.advanceTimersByTimeAsync(DOCUMENT_AUDIT_INTERVAL_MS - 1);

    expect(run).toHaveBeenCalledTimes(1);
  });
});

/**
 * Der Lauf gegen die echte Ablage und die echte Datenbank -- die beiden
 * Faelle aus req-034, jeder mit seiner eigenen Folge.
 */
describe("auditDocumentsOnce (req-034)", () => {
  let bildablage: string;

  beforeEach(async () => {
    testDb.pool = createTestDb();
    bildablage = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
    process.env.IMAGE_DIR = bildablage;
  });

  afterEach(async () => {
    await rm(bildablage, { recursive: true, force: true });
    delete process.env.IMAGE_DIR;
    vi.restoreAllMocks();
  });

  async function abgelegtesDokument(mitDatei = true): Promise<string> {
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
    return fileName;
  }

  it("entfernt eine Datei ohne Datensatz", async () => {
    const store = fileSystemDocumentStore();
    await store.save("verwaist.pdf", new Uint8Array([1]));

    await auditDocumentsOnce();

    expect(await store.list()).toEqual([]);
  });

  it("laesst die Datei eines Datensatzes liegen", async () => {
    const fileName = await abgelegtesDokument();

    await auditDocumentsOnce();

    expect(await fileSystemDocumentStore().list()).toEqual([fileName]);
  });

  it("fasst die POI-Fotos daneben nicht an", async () => {
    // Die Fotos der POIs (req-026) liegen im selben Bildverzeichnis, aber
    // nicht in der Dokumentenablage -- diese Pruefung geht sie nichts an.
    const { fileSystemPhotoStore } = await import("@/lib/images/photo-store");
    await fileSystemPhotoStore().save("poi-foto.jpg", new Uint8Array([1]));

    await auditDocumentsOnce();

    expect(await fileSystemPhotoStore().read("poi-foto.jpg")).not.toBeNull();
  });

  it("entfernt einen Datensatz ohne Datei NICHT, sondern meldet ihn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await abgelegtesDokument(false);

    const ergebnis = await auditDocumentsOnce();

    expect(await listDocuments(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
    expect(ergebnis?.missingFiles).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });

  it("stoert den Betrieb nicht, wenn die Ablage nicht eingerichtet ist", async () => {
    // Ohne IMAGE_DIR gibt es keine Ablage -- der Lauf meldet das und wirft
    // nicht; ein gescheiterter Lauf darf die Anwendung nicht mitnehmen.
    delete process.env.IMAGE_DIR;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(auditDocumentsOnce()).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
