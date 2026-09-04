// @vitest-environment node
import { describe, expect, it } from "vitest";
import { QR_QUIET_ZONE, qrCodeFor, qrCodeOf, qrMatrixFor } from "./qr-code";

/**
 * Zerlegt den SVG-Pfad wieder in die dunklen Module. So laesst sich pruefen,
 * was ein Scanner spaeter sieht -- ohne den Pfad Zeichen fuer Zeichen
 * festzuschreiben.
 */
function darkModules(path: string): Set<string> {
  const dark = new Set<string>();
  for (const match of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    dark.add(`${Number(match[1])},${Number(match[2])}`);
  }
  return dark;
}

/** Ob das Modul (Zeile, Spalte) dunkel ist -- ohne die Ruhezone gerechnet. */
function isDark(path: string, row: number, column: number): boolean {
  return darkModules(path).has(
    `${column + QR_QUIET_ZONE},${row + QR_QUIET_ZONE}`,
  );
}

describe("qrCodeFor (req-023)", () => {
  it("umgibt den Code mit der Ruhezone, die ein Scanner braucht", () => {
    const code = qrCodeFor("https://dev.wegfara.com/einladung?token=abc");

    for (const [column, row] of [...darkModules(code.path)].map((key) =>
      key.split(",").map(Number),
    )) {
      expect(column).toBeGreaterThanOrEqual(QR_QUIET_ZONE);
      expect(row).toBeGreaterThanOrEqual(QR_QUIET_ZONE);
      expect(column).toBeLessThan(code.size - QR_QUIET_ZONE);
      expect(row).toBeLessThan(code.size - QR_QUIET_ZONE);
    }
  });

  it("setzt in jede der drei Ecken das Suchmuster", () => {
    const code = qrCodeFor("https://dev.wegfara.com/einladung?token=abc");
    const last = code.size - 2 * QR_QUIET_ZONE - 7;

    for (const [row, column] of [
      [0, 0],
      [0, last],
      [last, 0],
    ]) {
      // Aussenring dunkel, Trennring hell, Kern wieder dunkel.
      expect(isDark(code.path, row, column)).toBe(true);
      expect(isDark(code.path, row + 1, column + 1)).toBe(false);
      expect(isDark(code.path, row + 3, column + 3)).toBe(true);
    }
  });

  it("waehlt fuer einen laengeren Link eine groessere Version", () => {
    const kurz = qrCodeFor("https://wegfara.com/einladung?token=kurz");
    const lang = qrCodeFor(
      `https://dev.wegfara.com/einladung?token=${"a".repeat(43)}`,
    );

    expect(lang.size).toBeGreaterThan(kurz.size);
  });

  it("erzeugt zu demselben Link denselben Code", () => {
    const url = `https://dev.wegfara.com/einladung?token=${"b".repeat(43)}`;

    expect(qrCodeFor(url)).toEqual(qrCodeFor(url));
  });
});

describe("qrMatrixFor (req-031)", () => {
  const text =
    "BCD\n002\n1\nSCT\n\nUwe Kremmel\nDE89370400440532013000\nEUR40.00";

  it("zeigt dieselben Module wie der Pfad -- nur als Raster", () => {
    const matrix = qrMatrixFor(text);
    const dunkel = darkModules(qrCodeFor(text).path);

    for (let row = 0; row < matrix.size; row += 1) {
      for (let column = 0; column < matrix.size; column += 1) {
        expect(matrix.dark[row][column]).toBe(dunkel.has(`${column},${row}`));
      }
    }
  });

  it("laesst die Ruhezone hell", () => {
    const matrix = qrMatrixFor(text);

    for (let i = 0; i < QR_QUIET_ZONE; i += 1) {
      expect(matrix.dark[i].some(Boolean)).toBe(false);
      expect(matrix.dark[matrix.size - 1 - i].some(Boolean)).toBe(false);
    }
  });

  it("ergibt denselben Code wie der Weg ueber den Text", () => {
    expect(qrCodeOf(qrMatrixFor(text))).toEqual(qrCodeFor(text));
  });
});
