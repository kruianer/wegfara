import type { Page } from "@playwright/test";
import {
  PRUEF_HOEHE_PX,
  REGEL_TEXT,
  sammleVerstoesse as regelnImBrowser,
  type Regel,
  type Verstoss,
} from "@/lib/design/bildschirm-regeln";
import { SCREEN_WIDTHS_PX, TIPPZIEL_PX } from "@/lib/design/stil";

/**
 * Die vier Regeln aus delivery/stack.md, Abschnitt "Bildschirmbreiten"
 * (req-049). Die drei Breiten und das Tippziel stehen seit req-089 in der
 * gemeinsamen Stil-Datei -- an genau einer Stelle fuer CSS und Tests.
 */
export { SCREEN_WIDTHS_PX };
export type { Regel, Verstoss };

interface BreitenVerstoss extends Verstoss {
  breite: number;
}

/**
 * Sammelt die Verstoesse der vier Regeln aus delivery/stack.md gegen die
 * aktuell im Browser gerenderte Seite, bei der Breite, auf die der
 * Aufrufer das Sichtfenster bereits gesetzt hat. Die Regeln selbst stehen
 * in lib/design/bildschirm-regeln.ts -- dieselben, die die Seiten-Mockups
 * pruefen (req-091).
 */
async function sammleVerstoesse(seite: Page): Promise<Verstoss[]> {
  return seite.evaluate(regelnImBrowser, TIPPZIEL_PX);
}

/**
 * Prueft die aktuell im Browser geladene Seite bei allen drei Breiten aus
 * delivery/stack.md gegen die vier Regeln dort und wirft mit einer Meldung,
 * die Seite, Breite, verletzte Regel und betroffenes Element benennt --
 * ohne dass dafuer die Seite selbst geoeffnet werden muesste (req-049).
 *
 * Das Sichtfenster steht danach wieder auf dem Stand vor dem Aufruf, damit
 * der restliche Testablauf unveraendert weiterlaeuft.
 */
export async function pruefeBildschirmbreiten(
  seite: Page,
  seitenName: string,
): Promise<void> {
  const urspruenglich = seite.viewportSize();
  const verstoesse: BreitenVerstoss[] = [];

  try {
    for (const breite of SCREEN_WIDTHS_PX) {
      await seite.setViewportSize({ width: breite, height: PRUEF_HOEHE_PX });
      // Zweimal auf den naechsten Frame warten, damit React auf die
      // Groessenaenderung (z.B. useWindowWidth) reagiert und neu gerendert
      // hat, bevor gemessen wird.
      await seite.evaluate(
        () =>
          new Promise<void>((erfuellen) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => erfuellen()),
            ),
          ),
      );
      const gefunden = await sammleVerstoesse(seite);
      for (const verstoss of gefunden) verstoesse.push({ ...verstoss, breite });
    }
  } finally {
    if (urspruenglich) await seite.setViewportSize(urspruenglich);
  }

  if (verstoesse.length === 0) return;

  const meldung = verstoesse
    .map(
      (v) =>
        `${seitenName} bei ${v.breite}px — ${REGEL_TEXT[v.regel]}: ${v.element} (${v.beschreibung})`,
    )
    .join("\n");
  throw new Error(
    `Bildschirmbreiten-Prüfung fehlgeschlagen (req-049):\n${meldung}`,
  );
}
