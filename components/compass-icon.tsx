import {
  KOMPASSROSE_AUSSEN,
  KOMPASSROSE_INNEN,
  KOMPASSROSE_STRICHSTAERKE,
  KOMPASSROSE_VIEWBOX,
} from "@/lib/icon/kompassrose";

/**
 * Die Kompassrose der Marke. Startseite und Anmeldeseite teilen sich
 * dasselbe Zeichen (siehe GUI in req-015 und req-016); seit req-065 auch das
 * Icon fuer Browser-Tab und Homescreen -- die Pfade stehen deshalb in
 * lib/icon/kompassrose.ts und nicht mehr hier.
 */
export function CompassIcon({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${KOMPASSROSE_VIEWBOX} ${KOMPASSROSE_VIEWBOX}`}
      aria-hidden="true"
    >
      <path
        d={KOMPASSROSE_AUSSEN}
        fill="none"
        stroke="currentColor"
        strokeWidth={KOMPASSROSE_STRICHSTAERKE}
        strokeLinejoin="round"
      />
      <path d={KOMPASSROSE_INNEN} fill="currentColor" />
    </svg>
  );
}
