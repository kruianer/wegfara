/**
 * Eine Aufzaehlung in Prosa: „A", „A und B", „A, B und C" (req-080).
 *
 * Das Heft wird gelesen, nicht bedient -- eine mit Punkten getrennte Liste
 * liest sich dort wie eine Tabelle.
 */
export function aufzaehlung(teile: string[]): string {
  if (teile.length <= 1) return teile[0] ?? "";
  return `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}`;
}

const ZAHLWOERTER = [
  "Null",
  "Ein",
  "Zwei",
  "Drei",
  "Vier",
  "Fünf",
  "Sechs",
  "Sieben",
  "Acht",
  "Neun",
  "Zehn",
  "Elf",
  "Zwölf",
];

/**
 * Eine Anzahl mit ihrem Wort, wie man sie in einer Ueberschrift schreibt:
 * „Sechs Tage", „Ein Tag", „14 Tage" (req-103). Bis zwoelf ausgeschrieben,
 * darueber in Ziffern.
 */
export function anzahlInWorten(
  anzahl: number,
  einzahl: string,
  mehrzahl: string,
): string {
  const wort = ZAHLWOERTER[anzahl] ?? String(anzahl);
  return `${wort} ${anzahl === 1 ? einzahl : mehrzahl}`;
}
