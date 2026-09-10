// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET } from "./route";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "wegfara-health-"));
  process.env.IMAGE_DIR = dir;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("GET /api/health (bug-027)", () => {
  it("meldet ok, solange die Bildablage beschreibbar ist", async () => {
    const antwort = await GET();

    expect(antwort.status).toBe(200);
    expect(await antwort.json()).toEqual({
      status: "ok",
      bildablage: { ok: true, problem: null },
    });
  });

  it("meldet einen Fehlerzustand, wenn sich nichts ablegen laesst", async () => {
    // Der Zustand aus bug-027: die Anwendung laeuft, aber kein Bild kann
    // entstehen. Bis dahin antwortete /api/health trotzdem mit "ok".
    const sperre = path.join(dir, "keine-ablage");
    await writeFile(sperre, "");
    process.env.IMAGE_DIR = sperre;

    const antwort = await GET();

    expect(antwort.status).toBe(503);
    expect(await antwort.json()).toEqual({
      status: "fehler",
      bildablage: { ok: false, problem: "nicht_beschreibbar" },
    });
  });

  it("meldet ein nicht gesetztes Bildverzeichnis", async () => {
    delete process.env.IMAGE_DIR;

    const antwort = await GET();

    expect(antwort.status).toBe(503);
    expect((await antwort.json()).bildablage.problem).toBe("nicht_gesetzt");
  });

  it("gibt den Pfad der Ablage nicht preis -- der Endpunkt ist oeffentlich", async () => {
    delete process.env.IMAGE_DIR;

    const text = await (await GET()).text();

    expect(text).not.toContain(dir);
  });
});
