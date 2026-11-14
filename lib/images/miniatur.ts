import path from "node:path";

/**
 * Die Miniatur eines Bildes (req-105). Die Listen und Kacheln zeichnen ein
 * Foto mit gut hundert Punkten Breite, das Original ist 1200 breit und im
 * Schnitt 350 KB gross -- durch den Tunnel ist das die Wartezeit beim
 * Oeffnen einer Reise. Zu jedem Bild entsteht deshalb beim Ablegen eine
 * verkleinerte Fassung daneben; das Original bleibt fuer die Vergroesserung.
 *
 * Die Miniatur ist abgeleitet, nicht eigenstaendig: sie hat keinen
 * Datensatz, sie liegt im selben Bildverzeichnis, ist am Namen zu erkennen
 * und geht mit ihrem Original.
 */

/**
 * 320 statt der 104 Punkte aus dem Layout: ein Bildschirm mit doppelter
 * Punktdichte zeichnet 208, und die POI-Auswahl der Planung zeigt das Bild
 * etwas breiter. 320 deckt beides ab.
 */
export const MINIATUR_BREITE_PX = 320;

/**
 * Die Miniatur ist immer ein WebP, gleich welcher Art das Original ist: klein,
 * mit Durchsichtigkeit, in jedem Browser darstellbar -- und damit ist auch ihr
 * Content-Type immer richtig, wie immer das Original heisst.
 */
export const MINIATUR_CONTENT_TYPE = "image/webp";
const MINIATUR_ENDUNG = ".miniatur.webp";
const MINIATUR_QUALITAET = 72;

/** Der Name der Miniatur zu einem Original: `<name>.miniatur.webp`. */
export function miniaturName(fileName: string): string {
  const name = path.basename(fileName);
  return `${name.slice(0, name.length - path.extname(name).length)}${MINIATUR_ENDUNG}`;
}

export function istMiniaturName(fileName: string): boolean {
  return fileName.endsWith(MINIATUR_ENDUNG);
}

export type BildArt =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "image/heic"
  | "image/heif";

function ascii(data: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...data.subarray(start, end));
}

/**
 * Die Art eines Bildes, erkannt am Inhalt und nicht an der Endung (req-105):
 * eine Datei `….jpg` kann ein PNG sein. Liefert null, wenn der Inhalt kein
 * bekanntes Bild ist.
 */
export function bildArtAmInhalt(data: Uint8Array): BildArt | null {
  if (
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    data.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => data[index] === byte,
    )
  ) {
    return "image/png";
  }
  if (data.length >= 4 && ascii(data, 0, 4) === "GIF8") return "image/gif";
  if (
    data.length >= 12 &&
    ascii(data, 0, 4) === "RIFF" &&
    ascii(data, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (data.length >= 12 && ascii(data, 4, 8) === "ftyp") {
    const marke = ascii(data, 8, 12);
    if (["heic", "heix", "heim", "heis", "hevc", "hevx"].includes(marke)) {
      return "image/heic";
    }
    if (["mif1", "msf1", "heif"].includes(marke)) return "image/heif";
  }
  return null;
}

/**
 * Verkleinert ein Bild auf die Breite der Miniatur. Liefert null, wenn der
 * Inhalt kein Bild ist; wirft, wenn er sich nicht verkleinern laesst (etwa
 * ein HEIC, das die Bibliothek nicht lesen kann) -- der Aufrufer entscheidet,
 * was dann gilt.
 *
 * Kleiner als das Original wird nie vergroessert: ein Bild unter 320 Punkten
 * bleibt so breit, wie es ist. Die Ausrichtung aus den EXIF-Angaben wird
 * eingerechnet, weil die Miniatur sie nicht mitnimmt.
 *
 * `sharp` laeuft nur hier, auf dem Server -- nie im Browser.
 */
export async function verkleinere(
  data: Uint8Array,
): Promise<Uint8Array | null> {
  if (!bildArtAmInhalt(data)) return null;
  const { default: sharp } = await import("sharp");
  const miniatur = await sharp(data)
    .rotate()
    .resize({ width: MINIATUR_BREITE_PX, withoutEnlargement: true })
    .webp({ quality: MINIATUR_QUALITAET })
    .toBuffer();
  return new Uint8Array(miniatur);
}

function fehlerText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Die Zeile im Server-Log, wenn eine Miniatur nicht entstehen konnte. */
export function protokolliereMiniaturFehler(
  fileName: string,
  error: unknown,
): void {
  console.warn(
    `miniatur: datei=${path.basename(fileName)} grund=${fehlerText(error)}`,
  );
}
