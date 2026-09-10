import Link from "next/link";
import type { Trip } from "@/lib/trips/types";
import type { WeatherReading } from "@/lib/weather/types";
import { formatDateRange } from "@/lib/trips/format";
import { PLANER_PATH } from "@/lib/einstieg/ziel";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";
import { MeinBereichLeiste } from "@/components/mein-bereich-leiste";
import { useWindowWidth } from "@/components/use-window-width";
import { ThemeButton } from "./theme-button";
import styles from "./header.module.css";

function SunIcon() {
  return (
    <svg
      className={styles.weatherIcon}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg
      className={styles.weatherIcon}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4a90d9"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3c4 5 6 7.9 6 11a6 6 0 0 1-12 0c0-3.1 2-6 6-11Z" />
    </svg>
  );
}

function PlanerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  );
}

export function Header({
  trip,
  weather,
  darfPlanen = false,
  onOpenTripSheet,
  onOpenThemeSheet,
}: {
  trip: Trip;
  weather: WeatherReading | null;
  /**
   * Ob die angemeldete Person auch den Planer darf (req-055) -- nur dann
   * steht hier der Wechsel dorthin. Wer ihn nicht darf, bekaeme sonst einen
   * Weg angeboten, der ihn gleich wieder hierher zurueckbrachte.
   *
   * Es ist dieselbe Regel, die vor dem Planer steht (`darfPlanen` in
   * lib/einstieg/ziel.ts, geprueft in app/plan/page.tsx): wer ihn aufrufen
   * darf, kommt auch hin (bug-035).
   */
  darfPlanen?: boolean;
  onOpenTripSheet: () => void;
  onOpenThemeSheet: () => void;
}) {
  // Der Begleiter laeuft im Regelfall auf dem Smartphone -- bis zur ersten
  // Messung gilt deshalb "schmal", damit der Wechsel dort nicht kurz
  // aufblitzt (bug-035).
  const fensterBreite = useWindowWidth(0);
  // Auf einem schmalen Bildschirm ergibt der Wechsel keinen Sinn: der Planer
  // verwiese dort nur auf einen breiteren (siehe app/plan/components/
  // narrow-notice.tsx). Ab seiner Mindestbreite gehoert der Weg sichtbar zu
  // sein -- dieselbe Zahl entscheidet auf beiden Seiten (bug-035).
  const zeigtWechsel = darfPlanen && fensterBreite >= PLANNER_MIN_WIDTH_PX;

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.switcher}
        onClick={onOpenTripSheet}
      >
        <span className={styles.tile} aria-hidden="true">
          {trip.title.charAt(0)}
        </span>
        <span className={styles.titleGroup}>
          <span className={styles.title}>{trip.title}</span>
          <span className={styles.subtitle}>
            {formatDateRange(trip)}
            {weather && (
              <span className={styles.weather}>
                <SunIcon />
                {Math.round(weather.temperatureC)}°
                <DropIcon />
                {Math.round(weather.precipitationProbabilityPercent)}%
              </span>
            )}
          </span>
        </span>
        <svg
          className={styles.chevron}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {zeigtWechsel && (
        /* Mit Beschriftung, nicht nur mit Symbol: zwischen den uebrigen
           Symbolen der Kopfzeile ging er sonst unter (bug-035). */
        <Link className={styles.wechsel} href={PLANER_PATH} title="Zum Planer">
          <PlanerIcon />
          <span className={styles.wechselText}>Zum Planer</span>
        </Link>
      )}
      <ThemeButton onOpen={onOpenThemeSheet} />
      <MeinBereichLeiste />
    </header>
  );
}
