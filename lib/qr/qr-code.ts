import qrcode from "qrcode-generator";

/**
 * Der QR-Code einer Einladung (req-023). Er wird nicht als Bild
 * ausgeliefert, sondern als Pfad fuer ein SVG: die Anzeige bleibt damit
 * beliebig skalierbar (ein QR-Code wird vom Geraet eines Mitreisenden
 * abgescannt und muss auch auf einem breiten Bildschirm gross genug sein)
 * und die Erzeugung bleibt ohne Browser testbar.
 */
export interface QrCode {
  /** Kantenlaenge in Modulen, einschliesslich der Ruhezone. */
  size: number;
  /** Die dunklen Module als SVG-Pfad, ein Quadrat je Modul. */
  path: string;
}

/**
 * Derselbe Code als Raster, Zeile fuer Zeile -- einschliesslich der
 * Ruhezone. Gebraucht wird er dort, wo der Code nicht als SVG angezeigt,
 * sondern als Bild gezeichnet wird (req-031): auf eine Zeichenflaeche laesst
 * sich ein Rechteck je Modul malen, ein SVG-Pfad nicht.
 */
export interface QrMatrix {
  /** Kantenlaenge in Modulen, einschliesslich der Ruhezone. */
  size: number;
  /** `dark[zeile][spalte]` -- true heisst dunkles Modul. */
  dark: boolean[][];
}

/**
 * Die Ruhezone rund um den Code. Vier Module sind das Mindestmass der
 * Norm -- ohne sie findet ein Scanner die Begrenzung nicht zuverlaessig.
 */
export const QR_QUIET_ZONE = 4;

/**
 * Fehlerkorrektur-Stufe M: haelt rund 15 Prozent Verlust aus und bleibt
 * dabei kompakt. Der Code wird vom Bildschirm abgescannt, nicht von
 * bedrucktem Papier -- eine hoehere Stufe wuerde ihn nur dichter machen.
 */
const ERROR_CORRECTION_LEVEL = "M";

/**
 * Erzeugt das Raster zu einem Text -- die Grundlage beider Darstellungen:
 * des SVG fuer die Anzeige und des Bildes zum Weitergeben (req-031).
 */
export function qrMatrixFor(text: string): QrMatrix {
  // 0 heisst: die kleinste Version waehlen, in die der Text passt.
  const code = qrcode(0, ERROR_CORRECTION_LEVEL);
  code.addData(text);
  code.make();

  const count = code.getModuleCount();
  const size = count + 2 * QR_QUIET_ZONE;
  const dark = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      dark[row + QR_QUIET_ZONE][column + QR_QUIET_ZONE] = code.isDark(
        row,
        column,
      );
    }
  }

  return { size, dark };
}

/** Das Raster als SVG-Pfad, ein Quadrat je dunklem Modul. */
export function qrCodeOf(matrix: QrMatrix): QrCode {
  const parts: string[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.dark[row][column]) parts.push(`M${column} ${row}h1v1h-1z`);
    }
  }
  return { size: matrix.size, path: parts.join("") };
}

/**
 * Erzeugt den QR-Code zu einem Text -- fuer die Einladung ist das der
 * Zugangslink (req-023). Beides fuehrt an dieselbe Stelle: der abgescannte
 * Code und der verschickte Link.
 */
export function qrCodeFor(text: string): QrCode {
  return qrCodeOf(qrMatrixFor(text));
}
