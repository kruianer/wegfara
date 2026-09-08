/**
 * Wie das Alter einer geteilten Position auf der Karte steht (req-050):
 * "vor 2 Min". Unter einer Minute steht "gerade eben", damit dort nie
 * "vor 0 Min" auftaucht.
 */
export function positionsAlterText(recordedAt: string, jetzt: Date): string {
  const alterMin = Math.round(
    (jetzt.getTime() - new Date(recordedAt).getTime()) / 60_000,
  );
  return alterMin < 1 ? "gerade eben" : `vor ${alterMin} Min`;
}
