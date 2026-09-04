import type { QrMatrix } from "./qr-code";

/**
 * Ein QR-Code als Bild (req-031). Wer den Code auf demselben Geraet sieht,
 * auf dem auch seine Banking-App laeuft, kann ihn nicht abscannen -- er
 * reicht ihn stattdessen als Bild an eine andere App weiter oder legt ihn
 * ab, damit die Banking-App ihn aus der Galerie liest.
 *
 * Gezeichnet wird aus dem Raster (QrMatrix) und nicht aus dem angezeigten
 * SVG: ein Rechteck je Modul kommt ohne den Umweg ueber ein geladenes Bild
 * aus und ergibt harte Kanten, die ein Scanner sicher liest.
 */

/**
 * Kantenlaenge eines Moduls im Bild. Ein Code von 41 Modulen wird damit
 * rund 500 Pixel breit -- gross genug fuer die Galerie, klein genug, um ihn
 * ueber die Teilen-Funktion weiterzureichen.
 */
export const QR_IMAGE_MODULE_PIXELS = 12;

/** Was aus dem Teilen geworden ist -- die Oberflaeche sagt es dem Nutzer. */
export type ShareOutcome =
  | "geteilt"
  | "gespeichert"
  | "abgebrochen"
  | "gescheitert";

/**
 * Malt den Code auf eine Zeichenflaeche. Farben sind bewusst fest: ein
 * QR-Code wird von einer fremden Kamera gelesen und braucht dafuer schwarze
 * Module auf weissem Grund -- der weisse Grund gehoert als Ruhezone zum
 * Code (siehe components/qr-code.tsx).
 */
export function drawQrMatrix(
  context: CanvasRenderingContext2D,
  matrix: QrMatrix,
  modulePixels: number,
): void {
  const edge = matrix.size * modulePixels;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, edge, edge);
  context.fillStyle = "#000000";
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!matrix.dark[row][column]) continue;
      context.fillRect(
        column * modulePixels,
        row * modulePixels,
        modulePixels,
        modulePixels,
      );
    }
  }
}

/**
 * Der Code als PNG-Datei, oder null, wenn das Geraet keine Zeichenflaeche
 * hergibt. Die Datei entsteht im Browser -- der Code verlaesst das Geraet
 * nicht (req-031, Constraints).
 */
export async function qrPngFile(
  matrix: QrMatrix,
  fileName: string,
): Promise<File | null> {
  try {
    const canvas = document.createElement("canvas");
    const edge = matrix.size * QR_IMAGE_MODULE_PIXELS;
    canvas.width = edge;
    canvas.height = edge;

    const context = canvas.getContext("2d");
    if (!context) return null;
    drawQrMatrix(context, matrix, QR_IMAGE_MODULE_PIXELS);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png");
    });
    if (!blob) return null;

    return new File([blob], fileName, { type: "image/png" });
  } catch {
    return null;
  }
}

/** Das Bild ablegen, wo das Geraet nichts zum Teilen anbietet. */
function saveFile(file: File): boolean {
  try {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reicht den Code als Bild an eine andere App weiter (req-031). Kennt das
 * Geraet das Teilen von Dateien nicht, wird das Bild stattdessen abgelegt --
 * aus der Galerie liest die Banking-App es ebenso.
 *
 * Bricht der Nutzer das Teilen ab, bleibt es dabei: dann ungefragt eine
 * Datei abzulegen waere nicht, was er wollte.
 */
export async function shareQrImage(
  matrix: QrMatrix,
  fileName: string,
  title: string,
): Promise<ShareOutcome> {
  const file = await qrPngFile(matrix, fileName);
  if (!file) return "gescheitert";

  const kannTeilen =
    typeof navigator.share === "function" &&
    (navigator.canShare?.({ files: [file] }) ?? false);

  if (kannTeilen) {
    try {
      await navigator.share({ files: [file], title });
      return "geteilt";
    } catch (error) {
      if ((error as Error | null)?.name === "AbortError") return "abgebrochen";
    }
  }

  return saveFile(file) ? "gespeichert" : "gescheitert";
}
