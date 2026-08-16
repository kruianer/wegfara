import type { Trip } from "@/lib/trips/types";
import type { WeatherReading } from "@/lib/weather/types";
import { formatDateRange } from "@/lib/trips/format";
import { KontoLeiste } from "@/components/konto-leiste";
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

export function Header({
  trip,
  weather,
  onOpenTripSheet,
  onOpenThemeSheet,
}: {
  trip: Trip;
  weather: WeatherReading | null;
  onOpenTripSheet: () => void;
  onOpenThemeSheet: () => void;
}) {
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
      <ThemeButton onOpen={onOpenThemeSheet} />
      <KontoLeiste />
    </header>
  );
}
