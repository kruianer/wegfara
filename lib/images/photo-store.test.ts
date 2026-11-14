// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { bildMasse, testFoto } from "@/tests/testfoto";
import {
  fileSystemFileStore,
  fileSystemPhotoStore,
  imageDir,
} from "./photo-store";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("imageDir (stack.md: Pfad nur ueber Umgebungsvariable)", () => {
  it("liefert den Pfad aus IMAGE_DIR", () => {
    process.env.IMAGE_DIR = dir;

    expect(imageDir()).toBe(dir);
  });

  it("wirft ohne gesetzte Umgebungsvariable", () => {
    expect(() => imageDir()).toThrow();
  });
});

describe("fileSystemPhotoStore (req-026)", () => {
  it("legt eine Datei ab und liest sie wieder", async () => {
    const store = fileSystemPhotoStore(dir);

    await store.save("foto.jpg", new Uint8Array([7, 8, 9]));

    expect(Array.from((await store.read("foto.jpg")) ?? [])).toEqual([7, 8, 9]);
    expect(await readdir(dir)).toEqual(["foto.jpg"]);
  });

  it("entfernt eine Datei", async () => {
    const store = fileSystemPhotoStore(dir);
    await store.save("foto.jpg", new Uint8Array([1]));

    await store.remove("foto.jpg");

    expect(await readdir(dir)).toEqual([]);
  });

  it("entfernt eine bereits fehlende Datei ohne Fehler", async () => {
    await expect(
      fileSystemPhotoStore(dir).remove("gibtsnicht.jpg"),
    ).resolves.toBeUndefined();
  });

  it("liefert null fuer eine fehlende Datei", async () => {
    expect(await fileSystemPhotoStore(dir).read("gibtsnicht.jpg")).toBeNull();
  });

  it("verlaesst die Ablage nicht, auch wenn der Name einen Pfad enthaelt", async () => {
    const daneben = path.join(dir, "..", "daneben.txt");
    await writeFile(daneben, "unberuehrt");
    const store = fileSystemPhotoStore(dir);

    await store.save("../daneben.txt", new Uint8Array([1]));

    expect(await readFile(daneben, "utf8")).toBe("unberuehrt");
    expect(await readdir(dir)).toEqual(["daneben.txt"]);
    await rm(daneben, { force: true });
  });
});

describe("fileSystemPhotoStore: Miniaturen (req-105)", () => {
  it("legt zu einem Foto seine Miniatur von 320 Punkten daneben", async () => {
    const store = fileSystemPhotoStore(dir);
    const original = await testFoto({ breite: 1200, hoehe: 800 });

    await store.save("foto.jpg", original);

    expect((await readdir(dir)).sort()).toEqual([
      "foto.jpg",
      "foto.miniatur.webp",
    ]);
    // Das Original bleibt, wie es war -- es ist die Vergroesserung.
    expect(Buffer.from((await store.read("foto.jpg"))!)).toEqual(
      Buffer.from(original),
    );
    const miniatur = await store.readMiniatur("foto.jpg");
    expect((await bildMasse(miniatur!)).breite).toBe(320);
    expect(miniatur!.byteLength).toBeLessThan(original.byteLength);
  });

  it("verkleinert auch ein PNG, das als .jpg abgelegt ist, zu einem WebP", async () => {
    const store = fileSystemPhotoStore(dir);

    await store.save(
      "49d541f8-971c-4aea-acd8-4a8b359c91e1.jpg",
      await testFoto({ breite: 1200, hoehe: 1697, art: "png" }),
    );

    const miniatur = await store.readMiniatur(
      "49d541f8-971c-4aea-acd8-4a8b359c91e1.jpg",
    );
    expect(await bildMasse(miniatur!)).toEqual({
      breite: 320,
      hoehe: 453,
      format: "webp",
    });
  });

  it("legt fuer etwas, das kein Bild ist, keine Miniatur an", async () => {
    const store = fileSystemPhotoStore(dir);

    await store.save("foto.jpg", new Uint8Array([1, 2, 3]));

    expect(await readdir(dir)).toEqual(["foto.jpg"]);
    expect(await store.readMiniatur("foto.jpg")).toBeNull();
  });

  it("behaelt das Original, wenn die Miniatur nicht entstehen kann", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = fileSystemPhotoStore(dir);
    const kaputt = (await testFoto()).slice(0, 40);

    await store.save("foto.jpg", kaputt);

    expect(await readdir(dir)).toEqual(["foto.jpg"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^miniatur: datei=foto\.jpg grund=/),
    );
    warn.mockRestore();
  });

  it("entfernt mit dem Original auch die Miniatur", async () => {
    const store = fileSystemPhotoStore(dir);
    await store.save("foto.jpg", await testFoto());

    await store.remove("foto.jpg");

    expect(await readdir(dir)).toEqual([]);
  });

  it("die reine Dateiablage (Dokumente) legt keine Miniatur an", async () => {
    await fileSystemFileStore(dir).save("beleg.jpg", await testFoto());

    expect(await readdir(dir)).toEqual(["beleg.jpg"]);
  });
});
