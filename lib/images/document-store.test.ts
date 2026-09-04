// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DOCUMENT_SUBDIR,
  documentDir,
  fileSystemDocumentStore,
} from "./document-store";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("documentDir (req-034, Constraints)", () => {
  it("liegt im Bildverzeichnis aus der Umgebungsvariable", () => {
    process.env.IMAGE_DIR = dir;

    expect(documentDir()).toBe(path.join(dir, DOCUMENT_SUBDIR));
  });

  it("wirft ohne gesetzte Umgebungsvariable -- kein fest verdrahteter Pfad", () => {
    expect(() => documentDir()).toThrow();
  });
});

describe("fileSystemDocumentStore (req-034)", () => {
  it("legt eine Datei ab und liest sie wieder", async () => {
    const store = fileSystemDocumentStore(dir);

    await store.save("aaaa.pdf", new Uint8Array([1, 2, 3]));

    expect(Array.from((await store.read("aaaa.pdf")) ?? [])).toEqual([1, 2, 3]);
  });

  it("nennt die abgelegten Dateien -- Grundlage der taeglichen Pruefung", async () => {
    const store = fileSystemDocumentStore(dir);
    await store.save("aaaa.pdf", new Uint8Array([1]));
    await store.save("bbbb.jpg", new Uint8Array([2]));

    expect((await store.list()).sort()).toEqual(["aaaa.pdf", "bbbb.jpg"]);
  });

  it("liefert eine leere Liste, solange nichts abgelegt wurde", async () => {
    expect(
      await fileSystemDocumentStore(path.join(dir, "gibtsnoch-nicht")).list(),
    ).toEqual([]);
  });

  it("entfernt eine Datei", async () => {
    const store = fileSystemDocumentStore(dir);
    await store.save("aaaa.pdf", new Uint8Array([1]));

    await store.remove("aaaa.pdf");

    expect(await store.list()).toEqual([]);
  });

  it("verlaesst die Ablage nicht, auch wenn der Name einen Pfad enthaelt", async () => {
    const daneben = path.join(dir, "daneben.txt");
    await writeFile(daneben, "unberuehrt");
    const ablage = path.join(dir, DOCUMENT_SUBDIR);

    await fileSystemDocumentStore(ablage).save(
      "../daneben.txt",
      new Uint8Array([1]),
    );

    expect(await readdir(ablage)).toEqual(["daneben.txt"]);
  });
});
