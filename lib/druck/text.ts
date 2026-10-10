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
