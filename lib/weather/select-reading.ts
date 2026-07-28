import { parseIsoDate } from "@/lib/trips/date-utils";
import type { OpenMeteoForecast, WeatherReading } from "./types";

/** Open-Meteo liefert Vorhersagen fuer heute + die naechsten 15 Tage. */
export const FORECAST_WINDOW_DAYS = 16;

function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function isWithinForecastWindow(
  selectedDate: string,
  todayIso: string,
): boolean {
  const diff = daysBetween(todayIso, selectedDate);
  return diff >= 0 && diff < FORECAST_WINDOW_DAYS;
}

/**
 * Waehlt die fuer den Kopfbereich anzuzeigende Wetterangabe: die
 * Tagesvorhersage, wenn der gewaehlte Tag innerhalb der naechsten 16 Tage
 * liegt und dafuer Werte vorliegen — sonst das aktuelle Wetter.
 */
export function selectWeatherReading(
  forecast: OpenMeteoForecast,
  selectedDate: string,
  todayIso: string,
): WeatherReading {
  if (isWithinForecastWindow(selectedDate, todayIso)) {
    const day = forecast.daily.find((d) => d.date === selectedDate);
    if (
      day &&
      day.maxTemperatureC !== null &&
      day.maxPrecipitationProbabilityPercent !== null
    ) {
      return {
        temperatureC: day.maxTemperatureC,
        precipitationProbabilityPercent: day.maxPrecipitationProbabilityPercent,
      };
    }
  }
  return forecast.current;
}
