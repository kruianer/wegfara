import { useCallback, useEffect, useRef, useState } from "react";
import type { BlockMass } from "@/lib/plan/block-bild";

/**
 * Misst die Bloecke des Zeitstrahls (req-111): je Kennung ihre Breite und
 * Hoehe samt Rahmen. Beides aendert sich, ohne dass der Zeitstrahl neu
 * zeichnet -- die Spalte am Trenner (req-109), die Stunde beim Zoomen
 * (req-076) --, deshalb beobachtet ein gemeinsamer ResizeObserver alle
 * Bloecke.
 *
 * Gemessen wird schon beim Einhaengen, vor dem ersten Zeichnen: so erscheint
 * ein Bild, das nicht passt, gar nicht erst. Ein Block ohne Groesse liegt
 * noch nicht im Layout und hat kein Mass.
 */
export function useBlockMasse(): {
  massVon: (id: string) => BlockMass | undefined;
  messRef: (id: string) => (element: HTMLElement | null) => void;
} {
  const [masse, setMasse] = useState<ReadonlyMap<string, BlockMass>>(
    () => new Map(),
  );
  const elemente = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (element: HTMLElement | null) => void>());
  const beobachter = useRef<ResizeObserver | null>(null);

  const miss = useCallback((id: string, element: HTMLElement) => {
    const breitePx = element.offsetWidth;
    const hoehePx = element.offsetHeight;
    const mass =
      breitePx === 0 && hoehePx === 0 ? undefined : { breitePx, hoehePx };
    setMasse((alt) => {
      const vorher = alt.get(id);
      if (
        vorher?.breitePx === mass?.breitePx &&
        vorher?.hoehePx === mass?.hoehePx
      ) {
        return alt;
      }
      const neu = new Map(alt);
      if (mass) neu.set(id, mass);
      else neu.delete(id);
      return neu;
    });
  }, []);

  const beobachten = useCallback(() => {
    if (!beobachter.current && typeof ResizeObserver !== "undefined") {
      beobachter.current = new ResizeObserver(() => {
        for (const [id, element] of elemente.current) miss(id, element);
      });
    }
    return beobachter.current;
  }, [miss]);

  useEffect(
    () => () => {
      beobachter.current?.disconnect();
      beobachter.current = null;
    },
    [],
  );

  const messRef = useCallback(
    (id: string) => {
      let ref = refs.current.get(id);
      if (!ref) {
        ref = (element: HTMLElement | null) => {
          const alt = elemente.current.get(id);
          if (alt && alt !== element) {
            beobachter.current?.unobserve(alt);
            elemente.current.delete(id);
          }
          if (!element) return;
          elemente.current.set(id, element);
          beobachten()?.observe(element);
          miss(id, element);
        };
        refs.current.set(id, ref);
      }
      return ref;
    },
    [beobachten, miss],
  );

  const massVon = useCallback((id: string) => masse.get(id), [masse]);

  return { massVon, messRef };
}
