"use client";

import { useEffect, useRef, useState } from "react";
import { BAUSTEINE, bausteinPfad, type Baustein } from "@/lib/design/baukasten";
import { SCREEN_WIDTHS_PX } from "@/lib/design/stil";
import styles from "./katalog.module.css";

/** Luft zwischen den drei Rahmen eines Bausteins, in Pixeln. */
const RAHMEN_ABSTAND_PX = 16;

/**
 * Unter diesem Massstab werden drei Rahmen nebeneinander zu klein zum
 * Ansehen -- dann stehen sie untereinander, jeder so breit wie moeglich.
 * Gleichzeitig zu sehen sind sie auch dann.
 */
const KLEINSTER_MASSSTAB_NEBENEINANDER = 0.35;

const SUMME_DER_BREITEN = SCREEN_WIDTHS_PX.reduce((a, b) => a + b, 0);

export type Anordnung = "nebeneinander" | "untereinander";

/**
 * Wie die drei Rahmen in der verfuegbaren Breite stehen und wie stark sie
 * verkleinert werden. Verkleinert wird nur das Bild -- im Rahmen gilt die
 * volle Breite, und auf die kommt es an.
 */
export function rahmenMassstab(
  verfuegbarPx: number,
  originalgroesse: boolean,
): { anordnung: Anordnung; massstab: (breite: number) => number } {
  if (originalgroesse) {
    return { anordnung: "nebeneinander", massstab: () => 1 };
  }
  const gemeinsam = Math.min(
    1,
    (verfuegbarPx - RAHMEN_ABSTAND_PX * (SCREEN_WIDTHS_PX.length - 1)) /
      SUMME_DER_BREITEN,
  );
  if (gemeinsam >= KLEINSTER_MASSSTAB_NEBENEINANDER) {
    return { anordnung: "nebeneinander", massstab: () => gemeinsam };
  }
  return {
    anordnung: "untereinander",
    massstab: (breite) => Math.min(1, verfuegbarPx / breite),
  };
}

/** Misst, wie hoch der Inhalt eines Rahmens ist, und meldet jede Aenderung. */
function useInhaltsHoehe(
  rahmen: React.RefObject<HTMLIFrameElement | null>,
  baustein: Baustein,
): number {
  const [hoehe, setHoehe] = useState(baustein.hoehePx);

  useEffect(() => {
    const iframe = rahmen.current;
    if (!iframe || baustein.festeHoehe) return;
    let beobachter: ResizeObserver | null = null;

    function messe() {
      const dokument = iframe?.contentDocument;
      if (!dokument?.body) return;
      setHoehe(Math.max(dokument.body.scrollHeight, 120));
      beobachter?.disconnect();
      beobachter = new ResizeObserver(() =>
        setHoehe(Math.max(dokument.body.scrollHeight, 120)),
      );
      beobachter.observe(dokument.body);
    }

    iframe.addEventListener("load", messe);
    if (iframe.contentDocument?.readyState === "complete") messe();
    return () => {
      iframe.removeEventListener("load", messe);
      beobachter?.disconnect();
    };
  }, [rahmen, baustein.festeHoehe]);

  return hoehe;
}

function Rahmen({
  baustein,
  breite,
  massstab,
}: {
  baustein: Baustein;
  breite: number;
  massstab: number;
}) {
  const rahmen = useRef<HTMLIFrameElement>(null);
  const hoehe = useInhaltsHoehe(rahmen, baustein);

  return (
    <figure
      className={styles.rahmen}
      data-testid={`rahmen-${baustein.id}-${breite}`}
      data-breite={breite}
    >
      <div
        className={styles.fenster}
        style={{ width: breite * massstab, height: hoehe * massstab }}
      >
        <iframe
          ref={rahmen}
          className={styles.iframe}
          src={bausteinPfad(baustein)}
          title={`${baustein.titel} bei ${breite} px`}
          width={breite}
          height={hoehe}
          style={{ transform: `scale(${massstab})` }}
        />
      </div>
      <figcaption className={styles.breite}>{breite} px</figcaption>
    </figure>
  );
}

/**
 * Der Katalog (req-089): jeder Baustein in drei Rahmen, bei 375, 768 und
 * 1280 px zugleich -- nebeneinander, solange die Breite es hergibt. Der
 * Unterschied zum Baukasten von Knipsa, der jeden Baustein nur einmal in der
 * aktuellen Fensterbreite zeigt.
 */
export function KatalogView() {
  const liste = useRef<HTMLDivElement>(null);
  const [verfuegbar, setVerfuegbar] = useState(1200);
  const [originalgroesse, setOriginalgroesse] = useState(false);

  useEffect(() => {
    const element = liste.current;
    if (!element) return;
    const messe = () => setVerfuegbar(element.clientWidth);
    messe();
    const beobachter = new ResizeObserver(messe);
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, []);

  const { anordnung, massstab } = rahmenMassstab(verfuegbar, originalgroesse);

  return (
    <div className={styles.seite}>
      <header className={styles.kopf}>
        <div>
          <h1 className={styles.titel}>Baukasten</h1>
          <p className={styles.unterzeile}>
            Jeder Baustein bei {SCREEN_WIDTHS_PX.join(", ")} px zugleich. Nur
            für die Entwicklung.
          </p>
        </div>
        <button
          type="button"
          className={styles.schalter}
          aria-pressed={originalgroesse}
          onClick={() => setOriginalgroesse((an) => !an)}
        >
          Originalgröße
        </button>
      </header>
      <div ref={liste} className={styles.liste}>
        {BAUSTEINE.map((baustein) => (
          <section
            key={baustein.id}
            className={styles.baustein}
            aria-labelledby={`baustein-${baustein.id}`}
            data-testid={`baustein-${baustein.id}`}
          >
            <h2 id={`baustein-${baustein.id}`} className={styles.name}>
              {baustein.titel}
            </h2>
            <p className={styles.zeigt}>{baustein.zeigt}</p>
            <div
              className={`${styles.reihe} ${
                anordnung === "untereinander" ? styles.untereinander : ""
              } ${originalgroesse ? styles.rollbar : ""}`}
              style={{ gap: RAHMEN_ABSTAND_PX }}
            >
              {SCREEN_WIDTHS_PX.map((breite) => (
                <Rahmen
                  key={breite}
                  baustein={baustein}
                  breite={breite}
                  massstab={massstab(breite)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
