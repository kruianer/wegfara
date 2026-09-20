import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Die Verpackung eines Backups fuers Herunterladen (req-071). Auf dem Server
 * bleibt ein Backup ein Verzeichnis (req-053) -- das ZIP entsteht erst beim
 * Herunterladen und ist kein zweites Backup-Format.
 *
 * Geschrieben wird stueckweise: jede Datei wandert als Strom ins Archiv,
 * nie liegt das ganze Backup im Arbeitsspeicher. Gepackt wird bewusst nicht
 * (Methode "gespeichert") -- Bilder sind bereits komprimiert, und das Rechnen
 * waere verschenkte Zeit.
 */

const LOCAL_SIGNATUR = 0x04034b50;
const CENTRAL_SIGNATUR = 0x02014b50;
const EOCD_SIGNATUR = 0x06054b50;
const ZIP64_EOCD_SIGNATUR = 0x06064b50;
const ZIP64_LOCATOR_SIGNATUR = 0x07064b50;

/** Methode 0: die Bytes liegen unveraendert im Archiv. */
const GESPEICHERT = 0;
/** Bit 11: der Name steht in UTF-8 -- Umlaute in Bildnamen bleiben heil. */
const UTF8_FLAG = 0x0800;

/**
 * Ab dieser Groesse traegt ein Feld nicht mehr in vier Bytes; dann bekommt
 * der Eintrag die ZIP64-Felder. Ein Backup mit vielen Bildern kann diese
 * Grenze reissen, deshalb ist sie hier vorgesehen und nicht ignoriert.
 */
export const ZIP64_GRENZE = 0xffffffff;

const CRC_TABELLE = (() => {
  const tabelle = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let wert = i;
    for (let bit = 0; bit < 8; bit += 1) {
      wert = wert & 1 ? 0xedb88320 ^ (wert >>> 1) : wert >>> 1;
    }
    tabelle[i] = wert >>> 0;
  }
  return tabelle;
})();

/** Die Pruefsumme fortschreiben -- beginnend bei 0xffffffff. */
export function crc32Weiter(crc: number, daten: Uint8Array): number {
  let wert = crc >>> 0;
  for (let i = 0; i < daten.length; i += 1) {
    wert = (CRC_TABELLE[(wert ^ daten[i]) & 0xff] ^ (wert >>> 8)) >>> 0;
  }
  return wert;
}

export function crc32(daten: Uint8Array): number {
  return (crc32Weiter(0xffffffff, daten) ^ 0xffffffff) >>> 0;
}

/** Zeitpunkt im DOS-Format, das jedes ZIP-Programm erwartet. */
function dosZeit(zeitpunkt: Date): { zeit: number; datum: number } {
  const jahr = Math.max(1980, zeitpunkt.getFullYear());
  return {
    zeit:
      (zeitpunkt.getHours() << 11) |
      (zeitpunkt.getMinutes() << 5) |
      (zeitpunkt.getSeconds() >> 1),
    datum:
      ((jahr - 1980) << 9) |
      ((zeitpunkt.getMonth() + 1) << 5) |
      zeitpunkt.getDate(),
  };
}

/** Was ins Archiv wandert: eine Datei auf der Platte oder ein Verzeichnis. */
export interface ZipQuelle {
  /** Der Name im Archiv, mit "/" als Trenner; Verzeichnisse enden auf "/". */
  name: string;
  /** Wo die Datei liegt -- ein Verzeichnis hat keinen. */
  path?: string;
  modified: Date;
}

/**
 * Alle Dateien und Verzeichnisse unterhalb von `root`, mit ihren Namen
 * relativ dazu. Verzeichnisse kommen mit in die Liste: so steht `images/`
 * auch dann im Archiv, wenn noch kein Bild gesichert wurde.
 */
export async function verzeichnisQuellen(root: string): Promise<ZipQuelle[]> {
  const quellen: ZipQuelle[] = [];

  async function sammle(dir: string, prefix: string): Promise<void> {
    const eintraege = await readdir(dir, { withFileTypes: true });
    for (const eintrag of eintraege.sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const ziel = path.join(dir, eintrag.name);
      const angaben = await stat(ziel);
      if (eintrag.isDirectory()) {
        quellen.push({
          name: `${prefix}${eintrag.name}/`,
          modified: angaben.mtime,
        });
        await sammle(ziel, `${prefix}${eintrag.name}/`);
      } else if (eintrag.isFile()) {
        quellen.push({
          name: `${prefix}${eintrag.name}`,
          path: ziel,
          modified: angaben.mtime,
        });
      }
    }
  }

  await sammle(root, "");
  return quellen;
}

interface Verzeichniseintrag {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
  zeit: number;
  datum: number;
}

function zip64Extra(werte: number[]): Buffer {
  const feld = Buffer.alloc(4 + werte.length * 8);
  feld.writeUInt16LE(0x0001, 0);
  feld.writeUInt16LE(werte.length * 8, 2);
  werte.forEach((wert, i) => feld.writeBigUInt64LE(BigInt(wert), 4 + i * 8));
  return feld;
}

function lokalerKopf(eintrag: Verzeichniseintrag, grenze: number): Buffer {
  const gross = eintrag.size > grenze;
  const extra = gross
    ? zip64Extra([eintrag.size, eintrag.size])
    : Buffer.alloc(0);
  const kopf = Buffer.alloc(30);
  kopf.writeUInt32LE(LOCAL_SIGNATUR, 0);
  kopf.writeUInt16LE(gross ? 45 : 20, 4);
  kopf.writeUInt16LE(UTF8_FLAG, 6);
  kopf.writeUInt16LE(GESPEICHERT, 8);
  kopf.writeUInt16LE(eintrag.zeit, 10);
  kopf.writeUInt16LE(eintrag.datum, 12);
  kopf.writeUInt32LE(eintrag.crc, 14);
  kopf.writeUInt32LE(gross ? ZIP64_GRENZE : eintrag.size, 18);
  kopf.writeUInt32LE(gross ? ZIP64_GRENZE : eintrag.size, 22);
  kopf.writeUInt16LE(eintrag.name.length, 26);
  kopf.writeUInt16LE(extra.length, 28);
  return Buffer.concat([kopf, eintrag.name, extra]);
}

function zentralerKopf(eintrag: Verzeichniseintrag, grenze: number): Buffer {
  const grosseDatei = eintrag.size > grenze;
  const weitHinten = eintrag.offset > grenze;
  const werte: number[] = [];
  if (grosseDatei) werte.push(eintrag.size, eintrag.size);
  if (weitHinten) werte.push(eintrag.offset);
  const extra = werte.length ? zip64Extra(werte) : Buffer.alloc(0);

  const kopf = Buffer.alloc(46);
  kopf.writeUInt32LE(CENTRAL_SIGNATUR, 0);
  kopf.writeUInt16LE(extra.length ? 45 : 20, 4);
  kopf.writeUInt16LE(extra.length ? 45 : 20, 6);
  kopf.writeUInt16LE(UTF8_FLAG, 8);
  kopf.writeUInt16LE(GESPEICHERT, 10);
  kopf.writeUInt16LE(eintrag.zeit, 12);
  kopf.writeUInt16LE(eintrag.datum, 14);
  kopf.writeUInt32LE(eintrag.crc, 16);
  kopf.writeUInt32LE(grosseDatei ? ZIP64_GRENZE : eintrag.size, 20);
  kopf.writeUInt32LE(grosseDatei ? ZIP64_GRENZE : eintrag.size, 24);
  kopf.writeUInt16LE(eintrag.name.length, 28);
  kopf.writeUInt16LE(extra.length, 30);
  kopf.writeUInt32LE(weitHinten ? ZIP64_GRENZE : eintrag.offset, 42);
  return Buffer.concat([kopf, eintrag.name, extra]);
}

function abschluss(
  eintraege: Verzeichniseintrag[],
  offset: number,
  groesse: number,
  grenze: number,
): Buffer[] {
  const teile: Buffer[] = [];
  const zuVieleEintraege = eintraege.length > 0xffff;
  const zip64 = zuVieleEintraege || offset > grenze || groesse > grenze;

  if (zip64) {
    const kopf = Buffer.alloc(56);
    kopf.writeUInt32LE(ZIP64_EOCD_SIGNATUR, 0);
    kopf.writeBigUInt64LE(44n, 4);
    kopf.writeUInt16LE(45, 12);
    kopf.writeUInt16LE(45, 14);
    kopf.writeBigUInt64LE(BigInt(eintraege.length), 24);
    kopf.writeBigUInt64LE(BigInt(eintraege.length), 32);
    kopf.writeBigUInt64LE(BigInt(groesse), 40);
    kopf.writeBigUInt64LE(BigInt(offset), 48);
    teile.push(kopf);

    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(ZIP64_LOCATOR_SIGNATUR, 0);
    locator.writeBigUInt64LE(BigInt(offset + groesse), 8);
    locator.writeUInt32LE(1, 16);
    teile.push(locator);
  }

  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(EOCD_SIGNATUR, 0);
  ende.writeUInt16LE(zuVieleEintraege ? 0xffff : eintraege.length, 8);
  ende.writeUInt16LE(zuVieleEintraege ? 0xffff : eintraege.length, 10);
  ende.writeUInt32LE(groesse > grenze ? ZIP64_GRENZE : groesse, 12);
  ende.writeUInt32LE(offset > grenze ? ZIP64_GRENZE : offset, 16);
  teile.push(ende);
  return teile;
}

/** Pruefsumme und Groesse einer Datei, ohne sie im Ganzen zu laden. */
async function pruefsumme(
  datei: string,
): Promise<{ crc: number; size: number }> {
  let crc = 0xffffffff;
  let size = 0;
  for await (const stueck of createReadStream(datei)) {
    const daten = stueck as Uint8Array;
    crc = crc32Weiter(crc, daten);
    size += daten.length;
  }
  return { crc: (crc ^ 0xffffffff) >>> 0, size };
}

async function* zipStuecke(
  quellen: ZipQuelle[],
  grenze: number,
): AsyncGenerator<Buffer> {
  const eintraege: Verzeichniseintrag[] = [];
  let offset = 0;

  for (const quelle of quellen) {
    const { crc, size } = quelle.path
      ? await pruefsumme(quelle.path)
      : { crc: 0, size: 0 };
    const { zeit, datum } = dosZeit(quelle.modified);
    const eintrag: Verzeichniseintrag = {
      name: Buffer.from(quelle.name, "utf8"),
      crc,
      size,
      offset,
      zeit,
      datum,
    };

    const kopf = lokalerKopf(eintrag, grenze);
    yield kopf;
    offset += kopf.length;

    if (quelle.path) {
      let geschrieben = 0;
      for await (const stueck of createReadStream(quelle.path)) {
        const daten = stueck as Buffer;
        geschrieben += daten.length;
        yield daten;
      }
      // Haette sich die Datei zwischen beiden Durchgaengen geaendert, waere
      // das Archiv still kaputt. Lieber laut abbrechen (vgl. bug-021).
      if (geschrieben !== size) {
        throw new Error(`Datei hat sich beim Packen geaendert: ${quelle.name}`);
      }
      offset += geschrieben;
    }

    eintraege.push(eintrag);
  }

  const verzeichnisOffset = offset;
  let verzeichnisGroesse = 0;
  for (const eintrag of eintraege) {
    const kopf = zentralerKopf(eintrag, grenze);
    verzeichnisGroesse += kopf.length;
    yield kopf;
  }

  for (const teil of abschluss(
    eintraege,
    verzeichnisOffset,
    verzeichnisGroesse,
    grenze,
  )) {
    yield teil;
  }
}

/**
 * Das Archiv als Strom. Der Aufrufer reicht ihn weiter, ohne ihn zu sammeln
 * -- ein Backup kann gross sein (siehe req-071, Constraints).
 */
export function zipStream(
  quellen: ZipQuelle[],
  options: { zip64Grenze?: number } = {},
): Readable {
  return Readable.from(
    zipStuecke(quellen, options.zip64Grenze ?? ZIP64_GRENZE),
  );
}
