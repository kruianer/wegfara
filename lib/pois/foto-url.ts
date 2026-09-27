/**
 * Die Adresse, unter der ein Foto eines POI herauskommt (req-026).
 *
 * Die Datei liegt im Bildverzeichnis ausserhalb des Repos und geht ueber die
 * eigene Schnittstelle heraus, nicht ueber den Bild-Optimierer von Next.
 *
 * Sie steht in lib/, weil beide Bereiche sie brauchen: der Planer zeigt die
 * Fotos eines POI (req-026), der Begleiter das erste davon auf der Kachel
 * seines Programmpunkts (req-079) — und die beiden importieren nichts
 * voneinander (stack.md, Conventions).
 */
export function poiFotoUrl(photoId: string): string {
  return `/api/poi-fotos/${photoId}`;
}
