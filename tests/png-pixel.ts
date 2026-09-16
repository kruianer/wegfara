import { inflateSync } from "node:zlib";

/**
 * Liest einzelne Bildpunkte aus einem PNG (req-065).
 *
 * Das Icon fuer den Homescreen muss auf einer deckenden Flaeche liegen --
 * Apple fuellt durchsichtige Bereiche mit Schwarz. Ob das so ist, laesst
 * sich nur am fertigen Bild pruefen, nicht an der Vorlage; deshalb dieser
 * kleine Leser.
 *
 * Bewusst knapp gehalten: er beherrscht genau die Bauart, die das Icon hat
 * (8 Bit je Kanal, RGBA, nicht verschraenkt) und weist alles andere ab,
 * statt es still falsch zu deuten.
 */

export interface Bildpunkt {
  r: number;
  g: number;
  b: number;
  /** 255 heisst deckend, 0 voellig durchsichtig. */
  a: number;
}

const SIGNATUR = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const KANAELE = 4;

export interface Bild {
  breite: number;
  hoehe: number;
  punkt(x: number, y: number): Bildpunkt;
}

function unfilter(zeilen: Buffer, breite: number, hoehe: number): Buffer {
  const schritt = breite * KANAELE;
  const bild = Buffer.alloc(schritt * hoehe);

  for (let y = 0; y < hoehe; y++) {
    const filter = zeilen[y * (schritt + 1)];
    const quelle = y * (schritt + 1) + 1;
    const ziel = y * schritt;

    for (let i = 0; i < schritt; i++) {
      const roh = zeilen[quelle + i];
      const links = i >= KANAELE ? bild[ziel + i - KANAELE] : 0;
      const oben = y > 0 ? bild[ziel - schritt + i] : 0;
      const obenLinks =
        y > 0 && i >= KANAELE ? bild[ziel - schritt + i - KANAELE] : 0;

      let wert: number;
      switch (filter) {
        case 0:
          wert = roh;
          break;
        case 1:
          wert = roh + links;
          break;
        case 2:
          wert = roh + oben;
          break;
        case 3:
          wert = roh + ((links + oben) >> 1);
          break;
        case 4:
          wert = roh + paeth(links, oben, obenLinks);
          break;
        default:
          throw new Error(`Unbekannter Zeilenfilter: ${filter}`);
      }
      bild[ziel + i] = wert & 0xff;
    }
  }

  return bild;
}

function paeth(links: number, oben: number, obenLinks: number): number {
  const summe = links + oben - obenLinks;
  const dLinks = Math.abs(summe - links);
  const dOben = Math.abs(summe - oben);
  const dObenLinks = Math.abs(summe - obenLinks);
  if (dLinks <= dOben && dLinks <= dObenLinks) return links;
  return dOben <= dObenLinks ? oben : obenLinks;
}

export function lesePng(daten: Buffer): Bild {
  if (!daten.subarray(0, 8).equals(SIGNATUR)) {
    throw new Error("Kein PNG.");
  }

  const breite = daten.readUInt32BE(16);
  const hoehe = daten.readUInt32BE(20);
  const bitTiefe = daten[24];
  const farbtyp = daten[25];
  const verschraenkt = daten[28];
  if (bitTiefe !== 8 || farbtyp !== 6 || verschraenkt !== 0) {
    throw new Error(
      `Nicht unterstuetzte PNG-Bauart: ${bitTiefe} Bit, Farbtyp ${farbtyp}, verschraenkt ${verschraenkt}.`,
    );
  }

  const bloecke: Buffer[] = [];
  let pos = 8;
  while (pos < daten.length) {
    const laenge = daten.readUInt32BE(pos);
    const art = daten.toString("ascii", pos + 4, pos + 8);
    if (art === "IDAT") {
      bloecke.push(daten.subarray(pos + 8, pos + 8 + laenge));
    }
    pos += 12 + laenge;
  }

  const bild = unfilter(inflateSync(Buffer.concat(bloecke)), breite, hoehe);

  return {
    breite,
    hoehe,
    punkt(x: number, y: number): Bildpunkt {
      const i = (y * breite + x) * KANAELE;
      return { r: bild[i], g: bild[i + 1], b: bild[i + 2], a: bild[i + 3] };
    },
  };
}

/** Der Bildpunkt als Hex-Schreibweise, wie sie im CSS steht. */
export function alsHex(punkt: Bildpunkt): string {
  return `#${[punkt.r, punkt.g, punkt.b]
    .map((wert) => wert.toString(16).padStart(2, "0"))
    .join("")}`;
}
