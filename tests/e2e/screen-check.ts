import type { Page } from "@playwright/test";

/**
 * Die drei Breiten und vier Regeln aus delivery/stack.md, Abschnitt
 * "Bildschirmbreiten" (req-049) -- an genau dieser Stelle im Code, damit eine
 * Aenderung der Vorgabe nicht mehrfach nachgezogen werden muss.
 */
export const SCREEN_WIDTHS_PX = [375, 768, 1280] as const;

/** Feste Hoehe fuer die Pruefung -- die Breite ist es, worauf es ankommt. */
const CHECK_HEIGHT_PX = 900;

export type Regel = "rand" | "ueberlappung" | "erreichbarkeit" | "tippziel";

const REGEL_TEXT: Record<Regel, string> = {
  rand: "Nichts steht über den Rand",
  ueberlappung: "Nichts überlappt",
  erreichbarkeit: "Alles Bedienbare ist erreichbar",
  tippziel: "Tippziele sind mindestens 44×44 px groß",
};

export interface Verstoss {
  regel: Regel;
  /** Beschreibt das betroffene Element -- testid, aria-label oder Text. */
  element: string;
  beschreibung: string;
}

interface BreitenVerstoss extends Verstoss {
  breite: number;
}

/**
 * Sammelt die Verstoesse der vier Regeln aus delivery/stack.md gegen die
 * aktuell im Browser gerenderte Seite, bei der Breite, auf die der
 * Aufrufer das Sichtfenster bereits gesetzt hat.
 *
 * Laeuft als eingeschleuste Funktion im Browser (page.evaluate) -- kein
 * Zugriff auf aeusseren Zustand, alles Noetige steht im DOM.
 */
async function sammleVerstoesse(seite: Page): Promise<Verstoss[]> {
  return seite.evaluate(() => {
    const MIN_TIPPZIEL = 44;
    const gefunden: { regel: string; element: string; beschreibung: string }[] =
      [];

    function istSichtbar(el: Element): boolean {
      const stil = getComputedStyle(el);
      if (stil.display === "none" || stil.visibility === "hidden") return false;
      if (el.closest('[aria-hidden="true"]')) return false;
      return true;
    }

    /**
     * MapLibre-Marker (POIs, Aktivitaeten): eigene Bibliothek, eigene
     * Groessen- und Positionslogik ohne Kollisionsvermeidung -- POIs am
     * selben Ort ueberlappen dort bewusst. Sie gehoeren nicht zu den
     * Formularen und Knoepfen, um die es in diesem Requirement geht.
     */
    function istKartenMarker(el: Element): boolean {
      return el.closest(".maplibregl-marker") !== null;
    }

    function istDeaktiviert(el: Element): boolean {
      return (
        "disabled" in el &&
        Boolean((el as unknown as { disabled?: boolean }).disabled)
      );
    }

    function beschreibe(el: Element): string {
      const testid = el.getAttribute("data-testid");
      if (testid) return `[data-testid="${testid}"]`;
      const label = el.getAttribute("aria-label");
      if (label) return `${el.tagName.toLowerCase()}[aria-label="${label}"]`;
      const text = (el.textContent ?? "").trim().slice(0, 40);
      return `${el.tagName.toLowerCase()}${text ? ` "${text}"` : ""}`;
    }

    // Regel 1: Nichts steht ueber den Rand -- die Seite laesst sich nicht
    // seitlich scrollen.
    const fensterBreite = window.innerWidth;
    if (document.documentElement.scrollWidth > fensterBreite + 1) {
      const kandidaten = Array.from(document.body.querySelectorAll("*")).filter(
        (el) => {
          if (!istSichtbar(el)) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > fensterBreite + 1 || r.left < -1);
        },
      );
      const oberste = kandidaten.filter(
        (el) =>
          !kandidaten.some((andere) => andere !== el && andere.contains(el)),
      );
      const ziel = oberste[0] ?? document.body;
      gefunden.push({
        regel: "rand",
        element: beschreibe(ziel),
        beschreibung: `Seite ist ${document.documentElement.scrollWidth}px breit bei ${fensterBreite}px Sichtfenster`,
      });
    }

    // Offene Dialoge (role="dialog"/aria-modal): was dahinter liegt, ist
    // waehrend sie offen sind bewusst nicht erreichbar -- kein Verstoss.
    const dialoge = Array.from(
      document.querySelectorAll('[role="dialog"], [aria-modal="true"]'),
    ).filter(istSichtbar);

    function hinterDialogVersteckt(el: Element): boolean {
      if (dialoge.length === 0) return false;
      return !dialoge.some((dialog) => dialog.contains(el));
    }

    const bedienbarSelektor =
      'button, a[href], input:not([type="hidden"]), select, textarea, ' +
      '[role="button"], [role="link"], [role="checkbox"], [role="radio"], ' +
      '[role="switch"], [role="tab"], summary';
    const bedienelemente = Array.from(
      document.querySelectorAll(bedienbarSelektor),
    ).filter((el) => {
      if (istKartenMarker(el)) return false;
      if (!istSichtbar(el)) return false;
      if (istDeaktiviert(el)) return false;
      if (hinterDialogVersteckt(el)) return false;
      return true;
    });

    // Ausserhalb des Sichtfensters liegende Elemente zaehlen erst als
    // Verstoss, wenn sie auch nach dem Hinscrollen nicht erreichbar sind --
    // senkrechtes Scrollen ist normal, waagerechtes durch Regel 1 verboten.
    const infos: { el: Element; rect: DOMRect }[] = [];
    for (const el of bedienelemente) {
      let rect = el.getBoundingClientRect();
      if (rect.height === 0 || rect.width === 0) continue;
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ block: "center", inline: "nearest" });
        rect = el.getBoundingClientRect();
      }
      infos.push({ el, rect });
    }

    // Regel 4: Tippziele sind mindestens 44x44 px gross.
    for (const { el, rect } of infos) {
      if (rect.width < MIN_TIPPZIEL - 0.5 || rect.height < MIN_TIPPZIEL - 0.5) {
        gefunden.push({
          regel: "tippziel",
          element: beschreibe(el),
          beschreibung: `${Math.round(rect.width)}×${Math.round(rect.height)}px`,
        });
      }
    }

    // Regel 3: Alles Bedienbare ist erreichbar -- am eigenen Mittelpunkt
    // liegt es selbst obenauf, nichts deckt es ab oder schneidet es ab.
    for (const { el, rect } of infos) {
      const cx = Math.min(
        Math.max(rect.left + rect.width / 2, 0),
        window.innerWidth - 1,
      );
      const cy = Math.min(
        Math.max(rect.top + rect.height / 2, 0),
        window.innerHeight - 1,
      );
      // Nur das Element selbst (oder etwas darin, z.B. ein Icon) zaehlt als
      // Treffer -- ein Vorfahre an dieser Stelle heisst, dass das Element
      // dort in Wahrheit gar nicht zu treffen ist (z.B. weggeschnitten durch
      // "overflow: hidden" beim Vorfahren).
      const oben = document.elementFromPoint(cx, cy);
      if (!oben || !(oben === el || el.contains(oben))) {
        gefunden.push({
          regel: "erreichbarkeit",
          element: beschreibe(el),
          beschreibung: oben
            ? `verdeckt durch ${beschreibe(oben)}`
            : "liegt außerhalb des sichtbaren Bereichs",
        });
      }
    }

    // Regel 2: Nichts ueberlappt -- paarweiser Vergleich der Bedienelemente,
    // ohne Vorfahren/Nachfahren-Paare und ohne Kartenmarker (s.o.).
    const gemeldet = new Set<string>();
    for (let i = 0; i < infos.length; i++) {
      for (let j = i + 1; j < infos.length; j++) {
        const a = infos[i];
        const b = infos[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const schnittBreite =
          Math.min(a.rect.right, b.rect.right) -
          Math.max(a.rect.left, b.rect.left);
        const schnittHoehe =
          Math.min(a.rect.bottom, b.rect.bottom) -
          Math.max(a.rect.top, b.rect.top);
        if (schnittBreite > 4 && schnittHoehe > 4) {
          const schluessel = [beschreibe(a.el), beschreibe(b.el)]
            .sort()
            .join("|");
          if (gemeldet.has(schluessel)) continue;
          gemeldet.add(schluessel);
          gefunden.push({
            regel: "ueberlappung",
            element: `${beschreibe(a.el)} und ${beschreibe(b.el)}`,
            beschreibung: `${Math.round(schnittBreite)}×${Math.round(schnittHoehe)}px Überlappung`,
          });
        }
      }
    }

    return gefunden as Verstoss[];
  });
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
      await seite.setViewportSize({ width: breite, height: CHECK_HEIGHT_PX });
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
