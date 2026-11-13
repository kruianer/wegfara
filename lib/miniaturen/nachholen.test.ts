// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { bildMasse, testFoto } from "@/tests/testfoto";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import { holeMiniaturenNach, miniaturenStand } from "./nachholen";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Originale, wie sie vor req-105 abgelegt wurden: ohne Miniatur. */
async function altbestand(anzahl: number): Promise<string[]> {
  const foto = await testFoto();
  const namen = Array.from(
    { length: anzahl },
    (_, i) => `alt-${String(i + 1).padStart(2, "0")}.jpg`,
  );
  for (const name of namen) await writeFile(path.join(dir, name), foto);
  return namen;
}

/** Der ganze Lauf, so wie ihn die Verwaltung Schritt fuer Schritt fuehrt. */
async function ganzerLauf(anzahl?: number) {
  const schritte = [];
  let nach: string | null = null;
  for (;;) {
    const schritt = await holeMiniaturenNach(dir, nach, anzahl);
    schritte.push(schritt);
    if (schritt.weiter === null) return schritte;
    nach = schritt.weiter;
  }
}

describe("miniaturenStand (req-105)", () => {
  it("zaehlt Originale und die mit Miniatur", async () => {
    await altbestand(2);
    await fileSystemPhotoStore(dir).save("neu.jpg", await testFoto());

    expect(await miniaturenStand(dir)).toEqual({ bilder: 3, mitMiniatur: 1 });
  });

  it("uebergeht die Dokumente und Schreibproben", async () => {
    await mkdir(path.join(dir, "dokumente"));
    await writeFile(path.join(dir, "dokumente", "ticket.jpg"), "x");
    await writeFile(path.join(dir, ".schreibprobe-1"), "");

    expect(await miniaturenStand(dir)).toEqual({ bilder: 0, mitMiniatur: 0 });
  });

  it("ist leer, solange das Verzeichnis fehlt", async () => {
    expect(await miniaturenStand(path.join(dir, "gibtsnicht"))).toEqual({
      bilder: 0,
      mitMiniatur: 0,
    });
  });
});

describe("holeMiniaturenNach (req-105)", () => {
  it("erzeugt die fehlenden Miniaturen und meldet den Fortschritt", async () => {
    const namen = await altbestand(5);

    const schritte = await ganzerLauf(2);

    expect(schritte.map((s) => s.geprueft)).toEqual([2, 4, 5]);
    expect(schritte.map((s) => s.erzeugt)).toEqual([2, 2, 1]);
    expect(schritte.at(-1)).toMatchObject({
      bilder: 5,
      mitMiniatur: 5,
      weiter: null,
    });
    for (const name of namen) {
      const miniatur = await fileSystemPhotoStore(dir).readMiniatur(name);
      expect((await bildMasse(miniatur!)).breite).toBe(320);
    }
  });

  it("verkleinert beim zweiten Lauf kein Bild noch einmal", async () => {
    await altbestand(3);
    await ganzerLauf();
    const vorher = await stat(path.join(dir, "alt-01.miniatur.webp"));

    const zweiter = await ganzerLauf();

    expect(zweiter.reduce((summe, s) => summe + s.erzeugt, 0)).toBe(0);
    expect(zweiter.at(-1)).toMatchObject({ bilder: 3, mitMiniatur: 3 });
    const nachher = await stat(path.join(dir, "alt-01.miniatur.webp"));
    expect(nachher.mtimeMs).toBe(vorher.mtimeMs);
  });

  it("ueberspringt, was beim Ablegen schon seine Miniatur bekam", async () => {
    await altbestand(1);
    await fileSystemPhotoStore(dir).save("neu.jpg", await testFoto());

    const [schritt] = await ganzerLauf();

    expect(schritt.erzeugt).toBe(1);
    expect(schritt.mitMiniatur).toBe(2);
  });

  it("macht nach einem Abbruch dort weiter, wo er stand", async () => {
    await altbestand(4);
    const erster = await holeMiniaturenNach(dir, null, 2);
    // Abgebrochen: niemand fragt weiter. Ein neuer Lauf beginnt von vorn,
    // ueberspringt das Fertige und erzeugt nur den Rest.

    const neu = await ganzerLauf(10);

    expect(erster.erzeugt).toBe(2);
    expect(neu[0].erzeugt).toBe(2);
    expect(neu[0].mitMiniatur).toBe(4);
  });

  it("zaehlt ein Bild, das sich nicht verkleinern laesst, und laeuft weiter", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await altbestand(2);
    await writeFile(
      path.join(dir, "alt-00-kaputt.jpg"),
      (await testFoto()).slice(0, 40),
    );

    const [schritt] = await ganzerLauf();

    expect(schritt).toMatchObject({
      bilder: 3,
      mitMiniatur: 2,
      erzeugt: 2,
      fehlgeschlagen: 1,
      weiter: null,
    });
  });

  it("fasst nur das Bildverzeichnis an und laesst die Originale, wie sie sind", async () => {
    await altbestand(1);
    const vorher = await stat(path.join(dir, "alt-01.jpg"));

    await ganzerLauf();

    expect((await readdir(dir)).sort()).toEqual([
      "alt-01.jpg",
      "alt-01.miniatur.webp",
    ]);
    const nachher = await stat(path.join(dir, "alt-01.jpg"));
    expect(nachher.size).toBe(vorher.size);
    expect(nachher.mtimeMs).toBe(vorher.mtimeMs);
  });
});
