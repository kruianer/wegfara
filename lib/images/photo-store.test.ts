// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileSystemPhotoStore, imageDir } from "./photo-store";

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
