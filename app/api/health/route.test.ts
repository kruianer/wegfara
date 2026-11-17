// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  clearVerschwundeneModelle,
  merkeVerschwunden,
} from "@/lib/ki-modelle/verschwunden";
import { GET } from "./route";

let dir: string;

beforeEach(async () => {
  clearVerschwundeneModelle();
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
      kiModelle: { ok: true, verschwunden: [] },
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
      kiModelle: { ok: true, verschwunden: [] },
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

describe("GET /api/health -- KI-Modelle (req-108)", () => {
  it("meldet ein eingestelltes Modell, das der Dienst nicht mehr nennt", async () => {
    merkeVerschwunden("account-1", "bilder", "gpt-image-1");

    const antwort = await GET();

    expect(antwort.status).toBe(200);
    expect(await antwort.json()).toEqual({
      status: "warnung",
      bildablage: { ok: true, problem: null },
      kiModelle: {
        ok: false,
        verschwunden: [{ zweck: "bilder", modell: "gpt-image-1" }],
      },
    });
  });

  it("nennt keinen Account -- der Endpunkt ist oeffentlich", async () => {
    merkeVerschwunden("eb873b95-257b-49c6-b08f-1709d6ad3b94", "fragen", "x-1");

    expect(await (await GET()).text()).not.toContain("eb873b95");
  });

  it("ist wieder ok, sobald das Modell dasteht oder ein anderes gewaehlt ist", async () => {
    merkeVerschwunden("account-1", "bilder", "gpt-image-1");
    merkeVerschwunden("account-1", "bilder", null);

    expect((await (await GET()).json()).status).toBe("ok");
  });
});
