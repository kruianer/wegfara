// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { bildablageMeldung, pruefeBildablage } from "./bildablage-pruefung";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "wegfara-ablage-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("pruefeBildablage (bug-027)", () => {
  it("legt ein noch fehlendes Verzeichnis an und meldet es als nutzbar", async () => {
    const neu = path.join(dir, "images");

    const zustand = await pruefeBildablage(neu);

    expect(zustand).toEqual({ ok: true, problem: null, detail: null });
    // Die Schreibprobe bleibt nicht liegen.
    expect(await readdir(neu)).toEqual([]);
  });

  it("nimmt den Pfad aus IMAGE_DIR, wenn keiner uebergeben wird", async () => {
    process.env.IMAGE_DIR = dir;

    expect((await pruefeBildablage()).ok).toBe(true);
  });

  it("meldet ein nicht gesetztes IMAGE_DIR", async () => {
    delete process.env.IMAGE_DIR;

    const zustand = await pruefeBildablage();

    expect(zustand.ok).toBe(false);
    expect(zustand.problem).toBe("nicht_gesetzt");
  });

  it("meldet ein Verzeichnis, in das sich nichts schreiben laesst", async () => {
    // Genau der Zustand aus bug-027: die Ablage ist da, die Anwendung kommt
    // aber nicht hinein. Statt der Rechte steht hier eine Datei im Weg --
    // das scheitert bei jedem Benutzer gleich, auch bei root.
    const sperre = path.join(dir, "keine-ablage");
    await writeFile(sperre, "");

    const zustand = await pruefeBildablage(sperre);

    expect(zustand.ok).toBe(false);
    expect(zustand.problem).toBe("nicht_beschreibbar");
    expect(zustand.detail).toBeTruthy();
  });
});

describe("bildablageMeldung", () => {
  it("schweigt, solange die Ablage nutzbar ist", async () => {
    expect(bildablageMeldung(await pruefeBildablage(dir))).toBeNull();
  });

  it("nennt den Grund, wenn sie es nicht ist", async () => {
    delete process.env.IMAGE_DIR;

    expect(bildablageMeldung(await pruefeBildablage())).toContain("IMAGE_DIR");
  });
});
