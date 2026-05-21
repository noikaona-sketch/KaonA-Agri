export type WeatherDay = {
  date: string;
  rain_probability: number | null;
  rainfall_mm: number | null;
  weather_condition: string | null;
};

export type WeatherReadinessLevel = 'suitable' | 'caution' | 'rain_risk';

export type WeatherReadiness = {
  date: string;
  level: WeatherReadinessLevel;
  label: string;
  rainfall_mm: number | null;
  rain_probability: number | null;
};

export type GetMockWeatherForecastParams = {
  startDate: string;
  days: number;
};

export type GetWeatherReadinessForecastParams = GetMockWeatherForecastParams;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const MOCK_FORECAST_PATTERN: ReadonlyArray<Pick<WeatherDay, 'rainfall_mm' | 'rain_probability' | 'weather_condition'>> = [
  { rainfall_mm: null, rain_probability: 15, weather_condition: 'partly_cloudy' },
  { rainfall_mm: 1.2, rain_probability: 25, weather_condition: 'cloudy' },
  { rainfall_mm: 4.5, rain_probability: 55, weather_condition: 'light_rain' },
  { rainfall_mm: 11.8, rain_probability: 85, weather_condition: 'heavy_rain' },
  { rainfall_mm: 2.4, rain_probability: 35, weather_condition: 'mostly_sunny' },
  { rainfall_mm: 7.9, rain_probability: 65, weather_condition: 'showers' },
  { rainfall_mm: 0.4, rain_probability: 20, weather_condition: 'sunny' },
];

const WEATHER_LABELS: Record<WeatherReadinessLevel, string> = {
  suitable: 'Suitable for harvest',
  caution: 'Harvest with caution',
  rain_risk: 'Rain risk - consider rescheduling',
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getMockWeatherForecast(params: GetMockWeatherForecastParams): WeatherDay[] {
  const { startDate, days } = params;

  if (days <= 0) {
    return [];
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime())) {
    return [];
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_IN_MS);
    const pattern = MOCK_FORECAST_PATTERN[index % MOCK_FORECAST_PATTERN.length];

    return {
      date: toIsoDate(date),
      rainfall_mm: pattern.rainfall_mm,
      rain_probability: pattern.rain_probability,
      weather_condition: pattern.weather_condition,
    };
  });
}

export function evaluateWeatherReadiness(day: WeatherDay): WeatherReadiness {
  const rainfall = day.rainfall_mm;

  let level: WeatherReadinessLevel = 'suitable';

  if (rainfall !== null && rainfall > 10) {
    level = 'rain_risk';
  } else if (rainfall !== null && rainfall >= 3) {
    level = 'caution';
  }

  return {
    date: day.date,
    level,
    label: WEATHER_LABELS[level],
    rainfall_mm: day.rainfall_mm,
    rain_probability: day.rain_probability,
  };
}

export function getWeatherReadinessForecast(
  params: GetWeatherReadinessForecastParams,
): WeatherReadiness[] {
  return getMockWeatherForecast(params).map(evaluateWeatherReadiness);
}
