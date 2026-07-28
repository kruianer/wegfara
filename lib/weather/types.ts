export interface WeatherReading {
  temperatureC: number;
  precipitationProbabilityPercent: number;
}

export interface DailyWeather {
  /** ISO-Datum (YYYY-MM-DD). */
  date: string;
  maxTemperatureC: number | null;
  maxPrecipitationProbabilityPercent: number | null;
}

export interface OpenMeteoForecast {
  current: WeatherReading;
  daily: DailyWeather[];
}
