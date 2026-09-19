// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { deflateRawSync } from "node:zlib";
import { crc32, verzeichnisQuellen, zipStream } from "./zip";
import { zipEintragLesen, zipOeffnen } from "./unzip";

/**
 * Die Verpackung fuers Herunterladen (req-071): was hineingelegt wurde, muss
 * unveraendert wieder herauskommen -- und zwar aus einem Archiv, das andere
 * Programme lesen koennen. Geprueft wird deshalb gegen die Struktur des
 * Formats und nicht gegen die eigene Schreibroutine allein.
 */

let ordner: string;

beforeEach(async () => {
  ordner = await mkdtemp(path.join(tmpdir(), "wegfara-zip-"));
});

afterEach(async () => {
  await rm(ordner, { recursive: true, force: true });
});

async function packe(
  quelle: string,
  options: { zip64Grenze?: number } = {},
): Promise<string> {
  const ziel = path.join(ordner, "archiv.zip");
  await pipeline(
    zipStream(await verzeichnisQuellen(quelle), options),
    createWriteStream(ziel),
  );
  return ziel;
}

async function beispielVerzeichnis(): Promise<string> {
  const quelle = path.join(ordner, "backup");
  await mkdir(path.join(quelle, "images"), { recursive: true });
  await writeFile(path.join(quelle, "datenbank.json"), '{"tables":[]}');
  await writeFile(path.join(quelle, "manifest.json"), '{"version":1}');
  await writeFile(path.join(quelle, "images", "beleg.png"), "BILD-BYTES");
  return quelle;
}

describe("zipStream (req-071)", () => {
  it("nimmt jede Datei des Verzeichnisses mit, samt Pfad", async () => {
    const archiv = await packe(await beispielVerzeichnis());

    const geoeffnet = await zipOeffnen(archiv);
    expect(geoeffnet).not.toBeNull();
    expect(geoeffnet!.eintraege.map((eintrag) => eintrag.name)).toEqual([
      "datenbank.json",
      "images/",
      "images/beleg.png",
      "manifest.json",
    ]);
    await geoeffnet!.handle.close();
  });

  it("liefert den Inhalt unveraendert zurueck", async () => {
    const archiv = await packe(await beispielVerzeichnis());

    const { handle, eintraege } = (await zipOeffnen(archiv))!;
    const bild = eintraege.find((e) => e.name === "images/beleg.png")!;
    expect((await zipEintragLesen(handle, bild)).toString()).toBe("BILD-BYTES");
    await handle.close();
  });

  it("nennt das Bildverzeichnis auch dann, wenn kein Bild darin liegt", async () => {
    const quelle = path.join(ordner, "leer");
    await mkdir(path.join(quelle, "images"), { recursive: true });
    await writeFile(path.join(quelle, "datenbank.json"), "{}");

    const { handle, eintraege } = (await zipOeffnen(await packe(quelle)))!;
    expect(eintraege.map((e) => e.name)).toContain("images/");
    await handle.close();
  });

  it("packt grosse Dateien nicht in den Arbeitsspeicher, sondern stueckweise", async () => {
    // Der Strom liefert mehrere Stuecke -- er baut das Archiv nicht als einen
    // Puffer zusammen (siehe req-071, Constraints).
    const quelle = path.join(ordner, "gross");
    await mkdir(quelle, { recursive: true });
    await writeFile(path.join(quelle, "daten.bin"), Buffer.alloc(200_000, 7));

    let stuecke = 0;
    let bytes = 0;
    for await (const stueck of zipStream(await verzeichnisQuellen(quelle))) {
      stuecke += 1;
      bytes += stueck.length;
    }
    expect(stuecke).toBeGreaterThan(2);
    expect(bytes).toBeGreaterThan(200_000);
  });

  it("traegt die Pruefsumme jeder Datei ein", async () => {
    const archiv = await packe(await beispielVerzeichnis());

    const { handle, eintraege } = (await zipOeffnen(archiv))!;
    const datenbank = eintraege.find((e) => e.name === "datenbank.json")!;
    expect(datenbank.crc).toBe(crc32(Buffer.from('{"tables":[]}')));
    await handle.close();
  });
});

describe("zipStream mit ZIP64 (req-071)", () => {
  /**
   * Ein Backup mit vielen Bildern sprengt die vier Gigabyte des alten
   * Formats. Geprueft wird der Weg mit einer kuenstlich niedrigen Grenze --
   * eine echte Datei dieser Groesse waere im Test nicht zu bezahlen.
   */
  it("bleibt mit den ZIP64-Feldern lesbar", async () => {
    const quelle = await beispielVerzeichnis();

    const archiv = await packe(quelle, { zip64Grenze: 4 });

    const { handle, eintraege } = (await zipOeffnen(archiv))!;
    expect(eintraege.map((e) => e.name)).toContain("images/beleg.png");
    const bild = eintraege.find((e) => e.name === "images/beleg.png")!;
    expect(bild.size).toBe("BILD-BYTES".length);
    expect((await zipEintragLesen(handle, bild)).toString()).toBe("BILD-BYTES");
    await handle.close();
  });
});

describe("zipOeffnen (req-071)", () => {
  it("weist zurueck, was kein ZIP ist", async () => {
    const datei = path.join(ordner, "foto.png");
    await writeFile(datei, Buffer.alloc(500, 3));

    expect(await zipOeffnen(datei)).toBeNull();
  });

  it("weist eine leere Datei zurueck", async () => {
    const datei = path.join(ordner, "leer.zip");
    await writeFile(datei, "");

    expect(await zipOeffnen(datei)).toBeNull();
  });

  it("liest auch ein gepacktes Archiv", async () => {
    // Wer die heruntergeladene Datei anderswo neu verpackt, bekommt in der
    // Regel Methode 8 (deflate) -- auch die muss ankommen.
    const inhalt = Buffer.from("x".repeat(500));
    const datei = path.join(ordner, "gepackt.zip");
    await writeFile(datei, gepacktesArchiv("datenbank.json", inhalt));

    const { handle, eintraege } = (await zipOeffnen(datei))!;
    expect(eintraege[0].method).toBe(8);
    expect((await zipEintragLesen(handle, eintraege[0])).toString()).toBe(
      inhalt.toString(),
    );
    await handle.close();
  });
});

/** Ein Archiv mit Methode 8, wie es fremde Programme schreiben. */
function gepacktesArchiv(name: string, inhalt: Buffer): Buffer {
  const namensBytes = Buffer.from(name, "utf8");
  const daten = deflateRawSync(inhalt);
  const pruefsumme = crc32(inhalt);

  const lokal = Buffer.alloc(30);
  lokal.writeUInt32LE(0x04034b50, 0);
  lokal.writeUInt16LE(20, 4);
  lokal.writeUInt16LE(8, 8);
  lokal.writeUInt32LE(pruefsumme, 14);
  lokal.writeUInt32LE(daten.length, 18);
  lokal.writeUInt32LE(inhalt.length, 22);
  lokal.writeUInt16LE(namensBytes.length, 26);

  const zentral = Buffer.alloc(46);
  zentral.writeUInt32LE(0x02014b50, 0);
  zentral.writeUInt16LE(20, 4);
  zentral.writeUInt16LE(20, 6);
  zentral.writeUInt16LE(8, 10);
  zentral.writeUInt32LE(pruefsumme, 16);
  zentral.writeUInt32LE(daten.length, 20);
  zentral.writeUInt32LE(inhalt.length, 24);
  zentral.writeUInt16LE(namensBytes.length, 28);
  zentral.writeUInt32LE(0, 42);

  const verzeichnisOffset = lokal.length + namensBytes.length + daten.length;
  const verzeichnisGroesse = zentral.length + namensBytes.length;

  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(1, 8);
  ende.writeUInt16LE(1, 10);
  ende.writeUInt32LE(verzeichnisGroesse, 12);
  ende.writeUInt32LE(verzeichnisOffset, 16);

  return Buffer.concat([lokal, namensBytes, daten, zentral, namensBytes, ende]);
}

describe("verzeichnisQuellen (req-071)", () => {
  it("liest auch tiefer liegende Dateien", async () => {
    const quelle = path.join(ordner, "tief");
    await mkdir(path.join(quelle, "images", "2026"), { recursive: true });
    await writeFile(path.join(quelle, "images", "2026", "a.png"), "A");

    const quellen = await verzeichnisQuellen(quelle);

    expect(quellen.map((q) => q.name)).toEqual([
      "images/",
      "images/2026/",
      "images/2026/a.png",
    ]);
  });

  it("liest die Datei von der Platte und nicht aus einem Puffer", async () => {
    const quelle = path.join(ordner, "eine");
    await mkdir(quelle, { recursive: true });
    const datei = path.join(quelle, "datenbank.json");
    await writeFile(datei, "INHALT");

    const [quellenEintrag] = await verzeichnisQuellen(quelle);

    expect(quellenEintrag.path).toBe(datei);
    expect(await readFile(quellenEintrag.path!, "utf8")).toBe("INHALT");
  });
});
