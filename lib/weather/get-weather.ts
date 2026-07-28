import type { MainPlace } from "@/lib/trips/types";
import type { WeatherReading } from "./types";
import { fetchOpenMeteoForecast } from "./open-meteo-client";
import { getCachedForecast, setCachedForecast, placeKey } from "./cache";
import { selectWeatherReading } from "./select-reading";

/**
 * Liefert die Wetterangabe fuer den gewaehlten Reisetag am Hauptort, oder
 * null, wenn die Wetterquelle nicht erreichbar ist. Pro Ort wird
 * hoechstens alle 15 Minuten neu abgerufen (siehe cache.ts) — ein Abruf
 * deckt bereits die naechsten 16 Tage ab, ein Tageswechsel innerhalb des
 * Fensters loest daher keinen erneuten Abruf aus.
 */
export async function getWeatherForDay(
  mainPlace: MainPlace,
  selectedDate: string,
  todayIso: string,
): Promise<WeatherReading | null> {
  const key = placeKey(mainPlace.lat, mainPlace.lng);
  const now = Date.now();

  let forecast = getCachedForecast(key, now);
  if (!forecast) {
    const fetched = await fetchOpenMeteoForecast(mainPlace.lat, mainPlace.lng);
    if (!fetched) return null;
    setCachedForecast(key, fetched, now);
    forecast = fetched;
  }

  return selectWeatherReading(forecast, selectedDate, todayIso);
}
