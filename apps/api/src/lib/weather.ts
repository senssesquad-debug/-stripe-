import type { Locale, WeatherDTO } from '@passtra/core';
import type pg from 'pg';
import type { HttpClient } from './http';

/**
 * MET Norway Locationforecast 2.0 (free, CC BY 4.0). Terms: identifying User-Agent, respect Expires,
 * coordinates truncated to 4 decimals, attribution required. Cached in Postgres until Expires.
 */
const SUMMARY: Record<string, Record<Locale, string>> = {
  clearsky: { en: 'Clear', el: 'Αίθριος', ru: 'Ясно' },
  fair: { en: 'Mostly clear', el: 'Λίγα σύννεφα', ru: 'Малооблачно' },
  partlycloudy: { en: 'Partly cloudy', el: 'Μερικώς συννεφιασμένος', ru: 'Переменная облачность' },
  cloudy: { en: 'Cloudy', el: 'Συννεφιασμένος', ru: 'Облачно' },
  fog: { en: 'Fog', el: 'Ομίχλη', ru: 'Туман' },
  rain: { en: 'Rain', el: 'Βροχή', ru: 'Дождь' },
  lightrain: { en: 'Light rain', el: 'Ασθενής βροχή', ru: 'Небольшой дождь' },
  heavyrain: { en: 'Heavy rain', el: 'Ισχυρή βροχή', ru: 'Сильный дождь' },
  rainshowers: { en: 'Showers', el: 'Μπόρες', ru: 'Ливни' },
  lightrainshowers: { en: 'Light showers', el: 'Ασθενείς μπόρες', ru: 'Небольшие ливни' },
  heavyrainshowers: { en: 'Heavy showers', el: 'Ισχυρές μπόρες', ru: 'Сильные ливни' },
  thunder: { en: 'Thunderstorms', el: 'Καταιγίδες', ru: 'Гроза' },
  snow: { en: 'Snow', el: 'Χιόνι', ru: 'Снег' },
  sleet: { en: 'Sleet', el: 'Χιονόνερο', ru: 'Мокрый снег' },
};

function summarize(symbol: string, locale: Locale): string {
  const base = symbol.replace(/_(day|night|polartwilight)$/, '');
  const key = base.includes('thunder') ? 'thunder' : base;
  return SUMMARY[key]?.[locale] ?? SUMMARY[key.replace(/showers$/, '')]?.[locale] ?? SUMMARY.cloudy![locale];
}

interface MetResponse {
  properties: { meta: { updated_at: string }; timeseries: Array<{ time: string; data: { instant: { details: { air_temperature: number } }; next_1_hours?: { summary: { symbol_code: string } }; next_6_hours?: { summary: { symbol_code: string } } } }> };
}

export async function getWeather(db: pg.Pool, http: HttpClient, lat: number, lng: number, locale: Locale, now = new Date()): Promise<WeatherDTO | null> {
  const la = lat.toFixed(2);
  const lo = lng.toFixed(2); // ~1 km grid: good cache hit rate, enough precision for "current weather"
  const key = `metno:${la},${lo}`;
  let payload: MetResponse | null = null;
  const cached = await db.query<{ payload: MetResponse; expires_at: Date; last_modified: string | null }>('SELECT payload, expires_at, last_modified FROM http_cache WHERE key = $1', [key]);
  const row = cached.rows[0];
  if (row && row.expires_at > now) payload = row.payload;
  else {
    try {
      const res = await http.json<MetResponse>(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${la}&lon=${lo}`, { timeoutMs: 8000, lastModified: row?.last_modified });
      payload = res.notModified ? row!.payload : res.data;
      const expires = res.expires ? new Date(res.expires) : new Date(now.getTime() + 30 * 60_000);
      await db.query(
        `INSERT INTO http_cache (key, payload, last_modified, expires_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, last_modified = EXCLUDED.last_modified, expires_at = EXCLUDED.expires_at, updated_at = now()`,
        [key, JSON.stringify(payload), res.lastModified ?? row?.last_modified ?? null, expires],
      );
    } catch {
      payload = row?.payload ?? null; // serve stale rather than nothing; UI shows the update time
    }
  }
  if (!payload) return null;
  const series = payload.properties.timeseries;
  const current = [...series].reverse().find((t) => new Date(t.time) <= now) ?? series[0];
  if (!current) return null;
  const symbol = current.data.next_1_hours?.summary.symbol_code ?? current.data.next_6_hours?.summary.symbol_code ?? 'cloudy';
  return {
    temperatureC: Math.round(current.data.instant.details.air_temperature),
    symbol,
    summary: summarize(symbol, locale),
    updatedAt: payload.properties.meta.updated_at,
    attribution: 'Weather data: MET Norway (CC BY 4.0)',
  };
}
