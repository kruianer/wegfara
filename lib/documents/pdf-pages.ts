/**
 * Die Seitenzahl einer PDF-Datei, damit sich in der Vollbildansicht
 * blaettern laesst (req-034). Ermittelt wird sie einmal beim Ablegen und
 * mit dem Datensatz gespeichert -- die Datei dafuer bei jeder Anzeige neu
 * zu lesen waere Verschwendung.
 *
 * Gezaehlt werden die Seitenobjekte der Datei (`/Type /Page`), ohne den
 * Seitenbaum (`/Type /Pages`). Das kommt ohne fremde Bibliothek aus und
 * reicht fuer den Zweck: gebraucht wird "eine Seite oder mehrere, und wenn
 * mehrere, wie viele". Laesst sich nichts erkennen -- etwa bei einer
 * komprimierten Objektstruktur --, liefert es null; die Ansicht zeigt die
 * Datei dann ohne Blaetterung.
 */
export function pdfPageCount(data: Uint8Array): number | null {
  // Latin-1: jedes Byte wird ein Zeichen. Die Schluesselwoerter einer
  // PDF-Datei sind ASCII, der Rest stoert dabei nicht.
  let text = "";
  const CHUNK = 8192;
  for (let i = 0; i < data.length; i += CHUNK) {
    text += String.fromCharCode(...data.subarray(i, i + CHUNK));
  }

  const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  if (pages && pages.length > 0) return pages.length;

  // Fallback: der Seitenbaum nennt seine Zahl selbst.
  const count = text.match(/\/Count\s+(\d+)/);
  if (count) {
    const value = Number(count[1]);
    if (Number.isInteger(value) && value > 0) return value;
  }
  return null;
}
