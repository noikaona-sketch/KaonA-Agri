'use client';

import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type DayForecast = {
  date:        string;   // 'YYYY-MM-DD'
  tempMax:     number;
  tempMin:     number;
  rainPct:     number;
  weatherCode: number;
};

type WeatherData = {
  location: string;
  today:    DayForecast;
  week:     DayForecast[];
};

// ─────────────────────────────────────────────────────────────────────────────
// WMO weather code → icon + label (TH)
// https://open-meteo.com/en/docs#weathervariables
// ─────────────────────────────────────────────────────────────────────────────
function wmoIcon(code: number, rainPct: number): { icon: string; label: string } {
  if (code === 0)              return { icon: '☀️',  label: 'แดดจัด' };
  if (code <= 2)               return { icon: '🌤️', label: 'มีเมฆบ้าง' };
  if (code === 3)              return { icon: '☁️',  label: 'เมฆมาก' };
  if (code <= 49)              return { icon: '🌫️', label: 'หมอก' };
  if (code <= 59)              return { icon: '🌦️', label: 'ฝนปรอยๆ' };
  if (code <= 69)              return { icon: '🌧️', label: 'ฝนตก' };
  if (code <= 79)              return { icon: '❄️',  label: 'หิมะ' };
  if (code <= 84)              return { icon: '⛈️', label: 'ฝนหนัก' };
  if (code <= 99)              return { icon: '⛈️', label: 'พายุฝน' };
  if (rainPct >= 70)           return { icon: '🌧️', label: 'ฝนตก' };
  if (rainPct >= 40)           return { icon: '🌦️', label: 'มีฝน' };
  return { icon: '🌤️', label: 'มีเมฆ' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch from Open-Meteo (free, no API key)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWeather(lat: number, lng: number, location: string): Promise<WeatherData | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude',  String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set('daily',     'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
    url.searchParams.set('timezone',  'Asia/Bangkok');
    url.searchParams.set('forecast_days', '7');

    const res  = await fetch(url.toString(), { next: { revalidate: 3600 } } as RequestInit);
    if (!res.ok) return null;
    const json = await res.json() as {
      daily: {
        time:                         string[];
        weathercode:                  number[];
        temperature_2m_max:           number[];
        temperature_2m_min:           number[];
        precipitation_probability_max: number[];
      };
    };

    const d = json.daily;
    const days: DayForecast[] = d.time.map((date, i) => ({
      date,
      tempMax:     Math.round(d.temperature_2m_max[i]),
      tempMin:     Math.round(d.temperature_2m_min[i]),
      rainPct:     d.precipitation_probability_max[i] ?? 0,
      weatherCode: d.weathercode[i],
    }));

    return { location, today: days[0], week: days };
  } catch {
    return null;
  }
}

// Cache in sessionStorage to avoid re-fetch on navigate
function cacheKey(lat: number, lng: number) {
  return `wx_${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

async function fetchWeatherCached(lat: number, lng: number, location: string): Promise<WeatherData | null> {
  if (typeof window === 'undefined') return null;
  try {
    const key = cacheKey(lat, lng);
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const { data, ts } = JSON.parse(cached) as { data: WeatherData; ts: number };
      if (Date.now() - ts < 3600_000) return data; // 1 hr cache
    }
    const data = await fetchWeather(lat, lng, location);
    if (data) sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    return data;
  } catch {
    return fetchWeather(lat, lng, location);
  }
}

// Day label (วันนี้/พรุ่งนี้/จ/อ/พ/พฤ/ศ/ส/อา)
function dayLabel(dateStr: string, i: number): string {
  if (i === 0) return 'วันนี้';
  if (i === 1) return 'พรุ่งนี้';
  const days = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  return days[new Date(dateStr).getDay()];
}

// ─────────────────────────────────────────────────────────────────────────────
// TODAY STRIP — compact 1-line for home page
// ─────────────────────────────────────────────────────────────────────────────
export function WeatherTodayStrip({ lat, lng, location }: { lat: number; lng: number; location: string }) {
  const [wx, setWx] = useState<WeatherData | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void fetchWeatherCached(lat, lng, location).then(setWx);
  }, [lat, lng]);

  if (!wx) return null;

  const { icon, label } = wmoIcon(wx.today.weatherCode, wx.today.rainPct);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 12,
      background: '#fff', border: '1px solid #e8ede8',
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>
          {label} · {wx.today.tempMax}°/{wx.today.tempMin}°C
          {wx.today.rainPct >= 30 && (
            <span style={{ marginLeft: 6, fontSize: 11, color: '#1565c0' }}>
              💧 ฝน {wx.today.rainPct}%
            </span>
          )}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>📍 {wx.location}</p>
      </div>
      {/* Mini 4-day preview */}
      <div style={{ display: 'flex', gap: 6 }}>
        {wx.week.slice(1, 4).map((d, i) => {
          const w = wmoIcon(d.weatherCode, d.rainPct);
          return (
            <div key={d.date} style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14 }}>{w.icon}</p>
              <p style={{ margin: 0, fontSize: 9, color: '#9ca3af' }}>{dayLabel(d.date, i + 1)}</p>
              <p style={{ margin: 0, fontSize: 9, color: '#374151', fontWeight: 700 }}>{d.tempMax}°</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7-DAY WIDGET — for plot detail / ไร่ของฉัน
// ─────────────────────────────────────────────────────────────────────────────
export function Weather7Day({ lat, lng, location }: { lat: number; lng: number; location: string }) {
  const [wx,      setWx]      = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void fetchWeatherCached(lat, lng, location).then((data) => {
      setWx(data);
      setLoading(false);
    });
  }, [lat, lng]);

  if (loading) return (
    <div style={{ padding: '12px 0', color: '#9ca3af', fontSize: 13 }}>กำลังโหลดสภาพอากาศ…</div>
  );
  if (!wx) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8ede8', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1565c0, #1976d2)',
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#fff' }}>☁️ พยากรณ์อากาศ 7 วัน</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>📍 {wx.location}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 22, color: '#fff' }}>{wmoIcon(wx.today.weatherCode, wx.today.rainPct).icon}</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#fff' }}>{wx.today.tempMax}°C</p>
        </div>
      </div>

      {/* 7-day scroll */}
      <div style={{
        display: 'flex', gap: 0,
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {wx.week.map((d, i) => {
          const w = wmoIcon(d.weatherCode, d.rainPct);
          const isToday = i === 0;
          const highRain = d.rainPct >= 60;
          return (
            <div key={d.date} style={{
              flex: '0 0 auto', minWidth: 72,
              padding: '12px 8px', textAlign: 'center',
              background: isToday ? '#e3f2fd' : 'transparent',
              borderRight: i < 6 ? '1px solid #f0f0f0' : 'none',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: isToday ? 800 : 400, color: isToday ? '#1565c0' : '#9ca3af' }}>
                {dayLabel(d.date, i)}
              </p>
              <p style={{ margin: '0 0 4px', fontSize: 22 }}>{w.icon}</p>
              <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: '#111' }}>
                {d.tempMax}°<span style={{ color: '#9ca3af', fontWeight: 400 }}>/{d.tempMin}°</span>
              </p>
              {d.rainPct > 0 && (
                <p style={{ margin: 0, fontSize: 10, color: highRain ? '#1565c0' : '#9ca3af', fontWeight: highRain ? 700 : 400 }}>
                  💧{d.rainPct}%
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Farming tip */}
      <WeatherFarmingTip today={wx.today} week={wx.week} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Farming tip based on forecast
// ─────────────────────────────────────────────────────────────────────────────
function WeatherFarmingTip({ today, week }: { today: DayForecast; week: DayForecast[] }) {
  const rainDays    = week.filter(d => d.rainPct >= 50).length;
  const hotDays     = week.filter(d => d.tempMax >= 38).length;
  const stormToday  = today.weatherCode >= 80;

  let tip: { icon: string; text: string; color: string; bg: string } | null = null;

  if (stormToday) {
    tip = { icon: '⛈️', text: 'วันนี้พายุฝน — ระวังน้ำท่วมในแปลง', color: '#c62828', bg: '#ffebee' };
  } else if (today.rainPct >= 70) {
    tip = { icon: '🌧️', text: 'วันนี้ฝนตกหนัก — ชะลอการใส่ปุ๋ย', color: '#1565c0', bg: '#e3f2fd' };
  } else if (rainDays >= 4) {
    tip = { icon: '💧', text: `${rainDays} วันข้างหน้าจะมีฝน — ไม่ต้องให้น้ำเพิ่ม`, color: '#1565c0', bg: '#e3f2fd' };
  } else if (hotDays >= 3) {
    tip = { icon: '🌡️', text: `ร้อนจัด ${hotDays} วัน — เพิ่มความถี่ให้น้ำ`, color: '#e65100', bg: '#fff3e0' };
  } else if (today.rainPct < 20 && today.tempMax < 35) {
    tip = { icon: '✅', text: 'สภาพอากาศดี — เหมาะใส่ปุ๋ยหรือพ่นยา', color: '#2e7d32', bg: '#e8f5e9' };
  }

  if (!tip) return null;

  return (
    <div style={{
      margin: '0 12px 12px',
      padding: '8px 12px', borderRadius: 8,
      background: tip.bg, border: `1px solid ${tip.color}33`,
      display: 'flex', gap: 8, alignItems: 'center',
    }}>
      <span style={{ fontSize: 16 }}>{tip.icon}</span>
      <p style={{ margin: 0, fontSize: 12, color: tip.color, fontWeight: 600 }}>{tip.text}</p>
    </div>
  );
}
