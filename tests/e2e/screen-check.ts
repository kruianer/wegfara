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

    /**
     * Die Bedienelemente, die MapLibre selbst in die Karte setzt: der
     * Herkunftsnachweis ("© MapLibre", "© OpenStreetMap") und sein
     * Umschalter. Sie stammen aus der Bibliothek, nicht aus dieser
     * Anwendung -- ihre Groesse laesst sich nicht aendern, ohne den
     * Nachweis zu verfaelschen, und OpenStreetMap verlangt ihn (siehe
     * delivery/stack.md). Sie liegen zudem fest in der Ecke der Karte und
     * geraten dort unter jeden Knopf, der darueber schwebt.
     *
     * Die Regeln aus req-049 gelten den Formularen und Knoepfen dieser
     * Anwendung; was eine fremde Bibliothek beitraegt, laesst sich damit
     * nicht pruefen.
     */
    function istKartenSteuerung(el: Element): boolean {
      return el.closest(".maplibregl-ctrl") !== null;
    }

    /**
     * Eine Trefferflaeche, die selbst nichts zeichnet (opacity: 0) -- etwa
     * das unsichtbare Eingabefeld hinter einer Ankreuzbox
     * (components/tippziel-checkbox.tsx). Solche Flaechen duerfen groesser
     * sein als das Sichtbare und einander ueberlagern (bug-029): sie schieben
     * dichte Zeilen sonst auf 44px auseinander. Fuer Regel 2 zaehlen sie
     * deshalb nicht mit -- was man nicht sieht, kann nichts verdecken. Dass
     * sie sich gegenseitig nicht unbedienbar machen, prueft Regel 3: dort
     * muss jedes Bedienelement an seiner eigenen Mittelposition obenauf
     * liegen.
     */
    function zeichnetNichts(el: Element): boolean {
      return getComputedStyle(el).opacity === "0";
    }

    /**
     * Ob der Nutzer in diesem Element selbst rollen kann: eine Leiste mit
     * "overflow: auto" oder "scroll", die mehr Inhalt hat als Platz -- etwa
     * die Reisetage des Begleiters oder die Karten einer Options-Gruppe. Bei
     * "overflow: hidden" kann er es nicht: was dort hinausragt, bekommt er nie
     * zu sehen, auch wenn scrollIntoView es programmatisch hereinholen wuerde.
     */
    function rollbarVomNutzer(el: Element, achse: "x" | "y"): boolean {
      const stil = getComputedStyle(el);
      const ueberlauf = achse === "x" ? stil.overflowX : stil.overflowY;
      if (ueberlauf !== "auto" && ueberlauf !== "scroll") return false;
      return achse === "x"
        ? el.scrollWidth > el.clientWidth + 1
        : el.scrollHeight > el.clientHeight + 1;
    }

    /**
     * Wo die Mitte eines Bedienelements von einem Vorfahren abgeschnitten
     * wird: der erste, dessen Kasten sie nicht enthaelt, samt Achse und der
     * Frage, ob der Nutzer dort rollen kann.
     */
    function abgeschnittenVon(
      el: Element,
    ): { vorfahre: Element; achse: "x" | "y"; rollbar: boolean } | null {
      const r = el.getBoundingClientRect();
      const mx = r.left + r.width / 2;
      const my = r.top + r.height / 2;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const stil = getComputedStyle(p);
        const k = p.getBoundingClientRect();
        if (stil.overflowX !== "visible" && (mx < k.left || mx > k.right)) {
          return { vorfahre: p, achse: "x", rollbar: rollbarVomNutzer(p, "x") };
        }
        if (stil.overflowY !== "visible" && (my < k.top || my > k.bottom)) {
          return { vorfahre: p, achse: "y", rollbar: rollbarVomNutzer(p, "y") };
        }
      }
      return null;
    }

    /**
     * Rollt ein Bedienelement senkrecht ins Bild -- in jeder rollenden Flaeche
     * darum und zuletzt im Fenster selbst. Bewusst nur senkrecht und bewusst
     * ohne scrollIntoView: waagerecht wischen heisst in dieser Anwendung
     * bedienen (die Options-Gruppe uebernimmt die eingerastete Karte als
     * Wahl, siehe app/go/components/activity-option-group.tsx), und die
     * Pruefung bedient nicht. Senkrecht rollen loest nichts aus -- das tut
     * jeder Nutzer auf jeder Seite.
     */
    function rolleSenkrechtInsBild(el: Element): void {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (!rollbarVomNutzer(p, "y")) continue;
        const k = p.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        p.scrollTop += r.top + r.height / 2 - (k.top + p.clientHeight / 2);
      }
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        window.scrollBy(0, r.top + r.height / 2 - window.innerHeight / 2);
      }
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
      if (istKartenSteuerung(el)) return false;
      if (!istSichtbar(el)) return false;
      if (istDeaktiviert(el)) return false;
      if (hinterDialogVersteckt(el)) return false;
      return true;
    });

    // Alle Bedienelemente einmal ausmessen, ohne dabei zu rollen: nur so
    // liegen alle Rechtecke im selben Koordinatensystem, was der paarweise
    // Vergleich (Regel 2) voraussetzt. Zuvor wurde mitten in dieser Schleife
    // hingescrollt -- danach stimmten die zuvor genommenen Rechtecke nicht
    // mehr, und auf einer Seite, die laenger ist als das Sichtfenster, meldete
    // die Pruefung Bedienelemente als verdeckt, die es nicht waren (bug-057,
    // aufgefallen am Begleiter). Regel 4 braucht ohnehin nur die Groesse, und
    // die aendert sich beim Rollen nicht; Regel 3 rollt selbst, Element fuer
    // Element, und misst dabei frisch.
    const infos: { el: Element; rect: DOMRect }[] = [];
    for (const el of bedienelemente) {
      const rect = el.getBoundingClientRect();
      if (rect.height === 0 || rect.width === 0) continue;
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

    // Regel 2: Nichts ueberlappt -- paarweiser Vergleich der Bedienelemente,
    // ohne Vorfahren/Nachfahren-Paare, ohne Kartenmarker und ohne
    // Trefferflaechen, die nichts zeichnen (s.o.).
    const gemeldet = new Set<string>();
    for (let i = 0; i < infos.length; i++) {
      for (let j = i + 1; j < infos.length; j++) {
        const a = infos[i];
        const b = infos[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (zeichnetNichts(a.el) || zeichnetNichts(b.el)) continue;
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

    // Regel 3: Alles Bedienbare ist erreichbar -- am eigenen Mittelpunkt liegt
    // es selbst obenauf, nichts deckt es ab oder schneidet es ab. Sie kommt
    // zuletzt, weil sie rollt: jedes Element wird einzeln ins Bild geholt und
    // dort frisch gemessen, damit der Vergleich nicht an einem veralteten
    // Rechteck haengt.
    for (const { el } of infos) {
      const abschnitt = abgeschnittenVon(el);
      // Was der Nutzer mit dem Finger ins Bild wischt, ist erreichbar -- die
      // Reisetage des Begleiters oder die Karten einer Options-Gruppe stehen
      // absichtlich zum Teil ausserhalb ihrer Leiste. Gepruefte Elemente sind
      // die, die gerade im Bild stehen; die uebrigen sieht die Pruefung beim
      // naechsten Aufruf, wenn die Leiste anders steht.
      if (abschnitt && abschnitt.achse === "x" && abschnitt.rollbar) continue;
      // Was ein Vorfahre wegschneidet, ohne dass der Nutzer dort rollen kann
      // ("overflow: hidden"), bekommt er nie zu sehen.
      if (abschnitt && !abschnitt.rollbar) {
        gefunden.push({
          regel: "erreichbarkeit",
          element: beschreibe(el),
          beschreibung: `abgeschnitten von ${beschreibe(abschnitt.vorfahre)}`,
        });
        continue;
      }

      rolleSenkrechtInsBild(el);
      const rect = el.getBoundingClientRect();
      const cx = Math.min(
        Math.max(rect.left + rect.width / 2, 0),
        window.innerWidth - 1,
      );
      const cy = Math.min(
        Math.max(rect.top + rect.height / 2, 0),
        window.innerHeight - 1,
      );
      // Nur das Element selbst (oder etwas darin, z.B. ein Icon) zaehlt als
      // Treffer -- ein Vorfahre an dieser Stelle heisst, dass das Element dort
      // in Wahrheit gar nicht zu treffen ist.
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
