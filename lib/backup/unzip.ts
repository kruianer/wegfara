import { createWriteStream } from "node:fs";
import { open, writeFile, type FileHandle } from "node:fs/promises";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";
import { crc32Weiter } from "./zip";

/**
 * Das Gegenstueck zu lib/backup/zip.ts: ein hochgeladenes Archiv wieder
 * auseinandernehmen (req-071). Gelesen wird ueber das zentrale Verzeichnis am
 * Ende der Datei -- so steht vor dem ersten geschriebenen Byte fest, was
 * drinsteckt und ob etwas fehlt.
 *
 * Die Datei wird dabei nie im Ganzen geladen: jeder Eintrag wandert als Strom
 * aus dem Archiv an seinen Platz.
 */

const CENTRAL_SIGNATUR = 0x02014b50;
const LOCAL_SIGNATUR = 0x04034b50;
const EOCD_SIGNATUR = 0x06054b50;
const ZIP64_EOCD_SIGNATUR = 0x06064b50;
const ZIP64_LOCATOR_SIGNATUR = 0x07064b50;

const GESPEICHERT = 0;
const GEPACKT = 8;
const UNBEKANNT = 0xffffffff;

/** Der Kommentar am Ende darf bis 64 KB lang sein -- so weit wird gesucht. */
const EOCD_SUCHFENSTER = 64 * 1024 + 22;

export interface ZipEintrag {
  name: string;
  /** 0 = gespeichert, 8 = gepackt. */
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  /** Wo der lokale Kopf dieses Eintrags in der Datei steht. */
  offset: number;
}

async function lies(
  handle: FileHandle,
  position: number,
  laenge: number,
): Promise<Buffer> {
  const puffer = Buffer.alloc(laenge);
  const { bytesRead } = await handle.read(puffer, 0, laenge, position);
  return puffer.subarray(0, bytesRead);
}

interface Zentralverzeichnis {
  offset: number;
  anzahl: number;
}

/** Das Ende des zentralen Verzeichnisses -- mit und ohne ZIP64. */
async function endeSuchen(
  handle: FileHandle,
  dateiGroesse: number,
): Promise<Zentralverzeichnis | null> {
  const fensterLaenge = Math.min(dateiGroesse, EOCD_SUCHFENSTER);
  const start = dateiGroesse - fensterLaenge;
  const fenster = await lies(handle, start, fensterLaenge);

  let stelle = -1;
  for (let i = fenster.length - 22; i >= 0; i -= 1) {
    if (fenster.readUInt32LE(i) === EOCD_SIGNATUR) {
      stelle = i;
      break;
    }
  }
  if (stelle < 0) return null;

  let anzahl = fenster.readUInt16LE(stelle + 10);
  let offset = fenster.readUInt32LE(stelle + 16);
  if (anzahl !== 0xffff && offset !== UNBEKANNT) return { offset, anzahl };

  // ZIP64: die wahren Angaben stehen im Satz davor, gefunden ueber den
  // Locator unmittelbar vor dem Ende.
  const locatorStelle = stelle - 20;
  if (locatorStelle < 0) return null;
  if (fenster.readUInt32LE(locatorStelle) !== ZIP64_LOCATOR_SIGNATUR) {
    return null;
  }
  const zip64Stelle = Number(fenster.readBigUInt64LE(locatorStelle + 8));
  const zip64 = await lies(handle, zip64Stelle, 56);
  if (zip64.length < 56 || zip64.readUInt32LE(0) !== ZIP64_EOCD_SIGNATUR) {
    return null;
  }
  anzahl = Number(zip64.readBigUInt64LE(32));
  offset = Number(zip64.readBigUInt64LE(48));
  return { offset, anzahl };
}

/** Die ZIP64-Felder eines Eintrags, in der Reihenfolge des Standards. */
function zip64Werte(extra: Buffer): number[] {
  let stelle = 0;
  while (stelle + 4 <= extra.length) {
    const kennung = extra.readUInt16LE(stelle);
    const laenge = extra.readUInt16LE(stelle + 2);
    if (kennung === 0x0001) {
      const werte: number[] = [];
      for (let i = 0; i + 8 <= laenge; i += 8) {
        werte.push(Number(extra.readBigUInt64LE(stelle + 4 + i)));
      }
      return werte;
    }
    stelle += 4 + laenge;
  }
  return [];
}

/**
 * Alle Eintraege eines Archivs. `null` heisst: das ist kein lesbares ZIP --
 * der Aufrufer sagt dann, was der Datei fehlt (req-071).
 */
export async function zipVerzeichnis(
  handle: FileHandle,
  dateiGroesse: number,
): Promise<ZipEintrag[] | null> {
  if (dateiGroesse < 22) return null;

  let ende: Zentralverzeichnis | null;
  try {
    ende = await endeSuchen(handle, dateiGroesse);
  } catch {
    return null;
  }
  if (!ende || ende.offset >= dateiGroesse) return null;

  const verzeichnis = await lies(
    handle,
    ende.offset,
    dateiGroesse - ende.offset,
  );
  const eintraege: ZipEintrag[] = [];
  let stelle = 0;

  for (let i = 0; i < ende.anzahl; i += 1) {
    if (stelle + 46 > verzeichnis.length) return null;
    if (verzeichnis.readUInt32LE(stelle) !== CENTRAL_SIGNATUR) return null;

    const nameLaenge = verzeichnis.readUInt16LE(stelle + 28);
    const extraLaenge = verzeichnis.readUInt16LE(stelle + 30);
    const kommentarLaenge = verzeichnis.readUInt16LE(stelle + 32);
    const nameStelle = stelle + 46;
    const extraStelle = nameStelle + nameLaenge;
    if (extraStelle + extraLaenge + kommentarLaenge > verzeichnis.length) {
      return null;
    }

    const eintrag: ZipEintrag = {
      name: verzeichnis.toString("utf8", nameStelle, extraStelle),
      method: verzeichnis.readUInt16LE(stelle + 10),
      crc: verzeichnis.readUInt32LE(stelle + 16),
      compressedSize: verzeichnis.readUInt32LE(stelle + 20),
      size: verzeichnis.readUInt32LE(stelle + 24),
      offset: verzeichnis.readUInt32LE(stelle + 42),
    };

    const werte = zip64Werte(
      verzeichnis.subarray(extraStelle, extraStelle + extraLaenge),
    );
    let naechster = 0;
    if (eintrag.size === UNBEKANNT) eintrag.size = werte[naechster++] ?? 0;
    if (eintrag.compressedSize === UNBEKANNT) {
      eintrag.compressedSize = werte[naechster++] ?? 0;
    }
    if (eintrag.offset === UNBEKANNT) eintrag.offset = werte[naechster++] ?? 0;

    eintraege.push(eintrag);
    stelle = extraStelle + extraLaenge + kommentarLaenge;
  }

  return eintraege;
}

/** Wo die Daten eines Eintrags anfangen -- hinter seinem lokalen Kopf. */
async function datenStelle(
  handle: FileHandle,
  eintrag: ZipEintrag,
): Promise<number> {
  const kopf = await lies(handle, eintrag.offset, 30);
  if (kopf.length < 30 || kopf.readUInt32LE(0) !== LOCAL_SIGNATUR) {
    throw new Error(`Eintrag ohne lokalen Kopf: ${eintrag.name}`);
  }
  return eintrag.offset + 30 + kopf.readUInt16LE(26) + kopf.readUInt16LE(28);
}

async function* mitPruefsumme(
  quelle: AsyncIterable<Buffer>,
  erwartet: number,
  name: string,
): AsyncGenerator<Buffer> {
  let crc = 0xffffffff;
  for await (const stueck of quelle) {
    crc = crc32Weiter(crc, stueck);
    yield stueck;
  }
  if ((crc ^ 0xffffffff) >>> 0 !== erwartet) {
    throw new Error(`Pruefsumme stimmt nicht: ${name}`);
  }
}

function quellStrom(handle: FileHandle, start: number, laenge: number) {
  return handle.createReadStream({
    start,
    end: start + laenge - 1,
    autoClose: false,
  });
}

/**
 * Den Inhalt eines Eintrags an sein Ziel leiten -- entpackt, wenn er gepackt
 * ist, und unterwegs gegen seine Pruefsumme gehalten.
 */
async function durchreichen(
  handle: FileHandle,
  eintrag: ZipEintrag,
  ziel: NodeJS.WritableStream,
): Promise<void> {
  const start = await datenStelle(handle, eintrag);
  const quelle = quellStrom(handle, start, eintrag.compressedSize);
  const pruefend = (roh: AsyncIterable<Buffer>) =>
    mitPruefsumme(roh, eintrag.crc, eintrag.name);

  if (eintrag.method === GEPACKT) {
    await pipeline(quelle, createInflateRaw(), pruefend, ziel);
    return;
  }
  await pipeline(quelle, pruefend, ziel);
}

/** Einen Eintrag in den Arbeitsspeicher holen -- nur fuer kleine Dateien. */
export async function zipEintragLesen(
  handle: FileHandle,
  eintrag: ZipEintrag,
): Promise<Buffer> {
  if (eintrag.size === 0) return Buffer.alloc(0);
  const stuecke: Buffer[] = [];
  const sammler = new Writable({
    write(stueck: Buffer, _kodierung, weiter) {
      stuecke.push(Buffer.from(stueck));
      weiter();
    },
  });
  await durchreichen(handle, eintrag, sammler);
  return Buffer.concat(stuecke);
}

/**
 * Einen Eintrag an seinen Platz schreiben. Der Inhalt laeuft als Strom durch
 * -- auch ein Bildverzeichnis von mehreren Gigabyte belastet den
 * Arbeitsspeicher nicht (siehe req-071, Constraints).
 */
export async function zipEintragSchreiben(
  handle: FileHandle,
  eintrag: ZipEintrag,
  ziel: string,
): Promise<void> {
  if (eintrag.method !== GESPEICHERT && eintrag.method !== GEPACKT) {
    throw new Error(`Unbekannte Packart: ${eintrag.name}`);
  }
  if (eintrag.size === 0) {
    await writeFile(ziel, "");
    return;
  }

  await durchreichen(handle, eintrag, createWriteStream(ziel));
}

/** Oeffnet ein Archiv und liest sein Verzeichnis. */
export async function zipOeffnen(
  datei: string,
): Promise<{ handle: FileHandle; eintraege: ZipEintrag[] } | null> {
  const handle = await open(datei, "r");
  try {
    const { size } = await handle.stat();
    const eintraege = await zipVerzeichnis(handle, size);
    if (!eintraege) {
      await handle.close();
      return null;
    }
    return { handle, eintraege };
  } catch (fehler) {
    await handle.close();
    throw fehler;
  }
}
