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
 * Erzeugt den QR-Code zu einem Text -- fuer die Einladung ist das der
 * Zugangslink (req-023). Beides fuehrt an dieselbe Stelle: der abgescannte
 * Code und der verschickte Link.
 */
export function qrCodeFor(text: string): QrCode {
  // 0 heisst: die kleinste Version waehlen, in die der Text passt.
  const code = qrcode(0, ERROR_CORRECTION_LEVEL);
  code.addData(text);
  code.make();

  const count = code.getModuleCount();
  const parts: string[] = [];
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (!code.isDark(row, column)) continue;
      parts.push(`M${column + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`);
    }
  }

  return { size: count + 2 * QR_QUIET_ZONE, path: parts.join("") };
}
