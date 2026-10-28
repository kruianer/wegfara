import type { ReactNode } from "react";
import type { DruckKarte, DruckStrich } from "@/lib/druck/types";
import { DRUCK_KARTEN_NACHWEIS } from "@/lib/druck/karte";
import { KARTEN_GRUND } from "@/lib/druck/tagesfarben";
import styles from "./reiseplan-druck.module.css";

/**
 * Eine Karte des gedruckten Reiseplans (req-103), als SVG gezeichnet: die
 * hellen Kacheln als Grund, darauf die Transfers als Linien und die Stationen
 * als Nadeln. Was lib/druck/karte.ts gerechnet hat, wird hier nur gezeichnet.
 *
 * Die Farben kommen aus lib/druck/tagesfarben.ts und stehen deshalb an den
 * Linien selbst, nicht im CSS (req-103, Constraints).
 *
 * Ohne Netz bleibt der Kartengrund leer; Linien und Nadeln stehen trotzdem
 * darauf, und der Plan bleibt druckbar.
 */

/** Die Strichmuster -- in Vielfachen der Linienbreite. */
const MUSTER: Record<DruckStrich, string | undefined> = {
  durchgezogen: undefined,
  gestrichelt: "12 8",
  kurzGestrichelt: "6 5",
  // Mit runden Enden wird aus einem Strich der Laenge 0,1 ein Punkt.
  gepunktet: "0.1 7",
};

/** Ein Strich der Legende in der Strichart einer Linie. */
export function StrichMuster({
  strich,
  farbe,
}: {
  strich: DruckStrich;
  farbe: string;
}) {
  return (
    <svg className={styles.legendeStrich} viewBox="0 0 24 6" aria-hidden="true">
      <line
        x1="2"
        y1="3"
        x2="22"
        y2="3"
        stroke={farbe}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray={MUSTER[strich]}
      />
    </svg>
  );
}

export function DruckKarteBild({
  karte,
  titel,
  testId,
  children,
}: {
  karte: DruckKarte;
  /** Was die Karte zeigt -- fuer Vorlesehilfen. */
  titel: string;
  testId: string;
  /** Was ueber der Karte liegt: Legende, Zahlenzeile. */
  children?: ReactNode;
}) {
  return (
    <div className={styles.karte} data-testid={testId}>
      <svg
        className={styles.karteFlaeche}
        viewBox={`0 0 ${karte.breite} ${karte.hoehe}`}
        role="img"
        aria-label={titel}
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width={karte.breite} height={karte.hoehe} fill={KARTEN_GRUND} />
        {karte.kacheln.map((kachel) => (
          <image
            key={kachel.url}
            href={kachel.url}
            x={kachel.x}
            y={kachel.y}
            width={kachel.groesse}
            height={kachel.groesse}
          />
        ))}
        {karte.linien.map((linie) => (
          <line
            key={linie.id}
            data-testid={`karte-linie-${linie.id}`}
            data-strich={linie.strich}
            data-tag={linie.tag}
            x1={linie.x1}
            y1={linie.y1}
            x2={linie.x2}
            y2={linie.y2}
            stroke={linie.farbe}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={MUSTER[linie.strich]}
          />
        ))}
        {karte.nadeln.map((nadel) => (
          <g key={nadel.id} data-testid={`karte-nadel-${nadel.id}`}>
            <title>{nadel.titel}</title>
            <circle
              cx={nadel.x}
              cy={nadel.y}
              r={nadel.nummer === null ? 5.5 : 9}
              fill={nadel.farbe}
              stroke="#fbfaf7"
              strokeWidth={1.6}
            />
            {nadel.nummer !== null && (
              <text
                x={nadel.x}
                y={nadel.y + 3.6}
                textAnchor="middle"
                className={styles.nadelNummer}
              >
                {nadel.nummer}
              </text>
            )}
          </g>
        ))}
      </svg>
      <span className={styles.karteNachweis}>{DRUCK_KARTEN_NACHWEIS}</span>
      {children}
    </div>
  );
}
