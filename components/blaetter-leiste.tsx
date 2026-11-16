"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  blaetterZiel,
  blaetterZustand,
  insBildZiel,
  type Bildlauf,
  type BlaetterZustand,
  type Richtung,
  type Spanne,
} from "@/lib/design/blaettern";
import { BlaetternIcon } from "./icons";
import styles from "./blaetter-leiste.module.css";

/**
 * Eine waagerecht rollende Leiste mit zwei Knoepfen zum Blaettern (req-110).
 *
 * Der Bildlaufbalken bleibt ausgeblendet -- an seiner Stelle steht an jedem
 * Ende ein Knopf, aber nur, solange die Leiste mehr Inhalt hat als Breite.
 * Jeder Klick verschiebt um genau einen Eintrag; wer den Knopf haelt,
 * blaettert weiter. Ein Knopf, in dessen Richtung es nicht weitergeht, ist
 * abgeschaltet und blass.
 *
 * Die Eintraege sind die direkten Kinder der Leiste. Der mit dem Index
 * `sichtbar` wird ins Bild gerollt, sobald er es werden soll -- beim
 * Aufgehen und bei jedem Wechsel --, und zwar ganz.
 *
 * Die Knoepfe stehen neben der Leiste, nicht darauf: sie nehmen ihr Platz
 * weg, verdecken keinen Eintrag und sind selbst nichts, worauf sich etwas
 * ablegen liesse. Mit der Tastatur sind sie nicht zu erreichen -- die
 * Eintraege sind es selbst, und der Browser rollt den mit dem Fokus von
 * sich aus ins Bild.
 *
 * Gebaut fuer die Tagauswahl der Planung; die Tagauswahl des Begleiters und
 * die Options-Karten haben dieselbe Leiste und koennen den Baustein spaeter
 * ebenso tragen.
 */
export function BlaetterLeiste({
  children,
  sichtbar,
  zurueckTitel,
  vorTitel,
  className,
  leisteClassName,
  knopfClassName,
  ...leisteAttribute
}: {
  children: ReactNode;
  /** Index des Eintrags, der ganz zu sehen sein soll. */
  sichtbar?: number;
  /** Was der linke Knopf ansagt, z.B. „Frühere Tage zeigen“. */
  zurueckTitel: string;
  /** Was der rechte Knopf ansagt, z.B. „Spätere Tage zeigen“. */
  vorTitel: string;
  /** Klasse des Rahmens um Knoepfe und Leiste. */
  className?: string;
  /** Klasse der rollenden Leiste selbst. */
  leisteClassName?: string;
  /** Klasse beider Knoepfe -- Farben und Rahmen des Ortes. */
  knopfClassName?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  const leiste = useRef<HTMLDivElement>(null);
  const [zustand, setZustand] = useState<BlaetterZustand>({
    noetig: false,
    zurueck: false,
    vor: false,
  });

  const messen = useCallback(() => {
    const element = leiste.current;
    if (!element) return;
    const neu = blaetterZustand(bildlaufVon(element));
    setZustand((alt) =>
      alt.noetig === neu.noetig &&
      alt.zurueck === neu.zurueck &&
      alt.vor === neu.vor
        ? alt
        : neu,
    );
  }, []);

  // Nach jedem Zeichnen: neue oder andere Eintraege aendern den Inhalt.
  useLayoutEffect(messen);

  // Die Breite aendert sich ohne neues Zeichnen -- am Trenner (req-109), beim
  // Drehen des Geraets, wenn die Knoepfe selbst erscheinen.
  useEffect(() => {
    const element = leiste.current;
    if (!element) return;
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, [messen]);

  // Wird ein Eintrag zum sichtbaren, rollt die Leiste ihn ganz ins Bild. Auch
  // wenn die Knoepfe erscheinen: dann wird die Leiste schmaler, und er
  // koennte hinter einem Ende verschwinden.
  useLayoutEffect(() => {
    const element = leiste.current;
    if (!element || sichtbar === undefined) return;
    const eintraege = spannenVon(element);
    const eintrag = eintraege[sichtbar];
    if (!eintrag) return;
    const ziel = insBildZiel(eintrag, bildlaufVon(element), eintraege[0].links);
    if (ziel !== element.scrollLeft) {
      element.scrollLeft = ziel;
      messen();
    }
  }, [sichtbar, zustand.noetig, messen]);

  const schritt = useCallback(
    (richtung: Richtung) => {
      const element = leiste.current;
      if (!element) return;
      element.scrollLeft = blaetterZiel(
        spannenVon(element),
        bildlaufVon(element),
        richtung,
      );
      messen();
    },
    [messen],
  );

  const halten = useHalten(schritt);

  return (
    <div className={`${styles.rahmen} ${className ?? ""}`}>
      {zustand.noetig && (
        <BlaetterKnopf
          richtung="zurueck"
          titel={zurueckTitel}
          aktiv={zustand.zurueck}
          className={knopfClassName}
          halten={halten}
        />
      )}
      <div
        {...leisteAttribute}
        ref={leiste}
        className={`${styles.leiste} ${leisteClassName ?? ""}`}
        onScroll={messen}
      >
        {children}
      </div>
      {zustand.noetig && (
        <BlaetterKnopf
          richtung="vor"
          titel={vorTitel}
          aktiv={zustand.vor}
          className={knopfClassName}
          halten={halten}
        />
      )}
    </div>
  );
}

function BlaetterKnopf({
  richtung,
  titel,
  aktiv,
  className,
  halten,
}: {
  richtung: Richtung;
  titel: string;
  aktiv: boolean;
  className?: string;
  halten: ReturnType<typeof useHalten>;
}) {
  return (
    <button
      type="button"
      className={`${styles.knopf} ${className ?? ""}`}
      aria-label={titel}
      title={titel}
      disabled={!aktiv}
      tabIndex={-1}
      data-testid={`blaettern-${richtung}`}
      onPointerDown={(event) => {
        if (event.button === 0) halten.beginnen(richtung);
      }}
      onClick={() => halten.klick(richtung)}
    >
      <BlaetternIcon richtung={richtung} />
    </button>
  );
}

/** So lange haelt der Finger, bis von selbst weitergeblaettert wird. */
const HALTEN_AB_MS = 400;
/** Und so schnell geht es dann weiter, Eintrag fuer Eintrag. */
const HALTEN_TAKT_MS = 150;

/**
 * Halten blaettert weiter (req-110: „wer weiter will, klickt oder haelt“).
 * Hat das Halten schon geblaettert, zaehlt der Klick beim Loslassen nicht
 * noch einmal. Losgelassen wird am Fenster: ein Knopf, der am Ende
 * abgeschaltet wird, meldet das Loslassen nicht mehr.
 */
function useHalten(schritt: (richtung: Richtung) => void) {
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takt = useRef<ReturnType<typeof setInterval> | null>(null);
  const gehalten = useRef(false);

  const aufhoeren = useCallback(() => {
    if (uhr.current !== null) clearTimeout(uhr.current);
    if (takt.current !== null) clearInterval(takt.current);
    uhr.current = null;
    takt.current = null;
  }, []);

  useEffect(() => aufhoeren, [aufhoeren]);

  return {
    beginnen(richtung: Richtung) {
      aufhoeren();
      gehalten.current = false;
      window.addEventListener("pointerup", aufhoeren, { once: true });
      window.addEventListener("pointercancel", aufhoeren, { once: true });
      uhr.current = setTimeout(() => {
        takt.current = setInterval(() => {
          gehalten.current = true;
          schritt(richtung);
        }, HALTEN_TAKT_MS);
      }, HALTEN_AB_MS);
    },
    klick(richtung: Richtung) {
      aufhoeren();
      if (gehalten.current) {
        gehalten.current = false;
        return;
      }
      schritt(richtung);
    },
  };
}

function bildlaufVon(element: HTMLElement): Bildlauf {
  return {
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  };
}

function spannenVon(element: HTMLElement): Spanne[] {
  return Array.from(element.children, (kind) => {
    const eintrag = kind as HTMLElement;
    return { links: eintrag.offsetLeft, breite: eintrag.offsetWidth };
  });
}
