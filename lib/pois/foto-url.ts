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
 *
 * Das ist das Original — es gehoert in die Vergroesserung und in den Druck.
 * Listen und Kacheln nehmen die Miniatur (`poiMiniaturUrl`, req-105).
 */
export function poiFotoUrl(photoId: string): string {
  return `/api/poi-fotos/${photoId}`;
}

/**
 * Woran die Bild-Routen erkennen, dass die Miniatur gewuenscht ist
 * (req-105): `?groesse=miniatur`. Fehlt sie noch, kommt das Original —
 * langsam ist besser als leer.
 */
export const FOTO_GROESSE_PARAM = "groesse";
export const FOTO_GROESSE_MINIATUR = "miniatur";

/** Die Miniatur eines POI-Fotos — fuer jede Liste und jede Kachel. */
export function poiMiniaturUrl(photoId: string): string {
  return `${poiFotoUrl(photoId)}?${FOTO_GROESSE_PARAM}=${FOTO_GROESSE_MINIATUR}`;
}

/** Ob eine Anfrage an eine Bild-Route die Miniatur will. */
export function willMiniatur(request: Request): boolean {
  return (
    new URL(request.url).searchParams.get(FOTO_GROESSE_PARAM) ===
    FOTO_GROESSE_MINIATUR
  );
}
