'use client';

// leaflet-map-inner.tsx
// โหลด file นี้ผ่าน dynamic import (ssr: false) เท่านั้น
// ป้องกัน "document is not defined" error ใน Next.js SSR

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

type MapPlot = {
  cycle_id: string; member_name: string; crop_name: string;
  plot_name: string; province: string | null;
  planted_at: string | null; harvest_date_estimated: string | null;
  days_to_harvest: number | null; area_planted_rai: number | null;
  estimated_yield_kg: number | null; estimated_revenue: number | null;
  price_per_kg: number | null; map_color: string;
  lat: number; lng: number; status: string;
};

type Props = {
  plots: MapPlot[];
  colorMap: Record<string, string>;
  onSelect: (plot: MapPlot) => void;
};

type LeafletDefaultIconPrototype = L.Icon.Default & {
  _getIconUrl?: unknown;
};

// fix default icon ของ leaflet (webpack ทำ path พัง)
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function LeafletMapInner({ plots, colorMap, onSelect }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const leafletRef  = useRef<L.Map | null>(null);
  const markersRef  = useRef<L.CircleMarker[]>([]);

  // init map ครั้งเดียว
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    const validPlots = plots.filter((p) => p.lat && p.lng);
    const avgLat = validPlots.length > 0 ? validPlots.reduce((s, p) => s + p.lat, 0) / validPlots.length : 15.0;
    const avgLng = validPlots.length > 0 ? validPlots.reduce((s, p) => s + p.lng, 0) / validPlots.length : 102.0;

    const map = L.map(mapRef.current, { zoomControl: true }).setView([avgLat, avgLng], 10);
    leafletRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    return () => {
      map.remove();
      leafletRef.current = null;
    };
  }, []);

  // update markers เมื่อ plots เปลี่ยน
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;

    // clear markers เดิม
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const validPlots = plots.filter((p) => p.lat && p.lng);
    validPlots.forEach((p) => {
      const color = colorMap[p.map_color] ?? '#2e7d32';
      const harvestText = p.days_to_harvest != null
        ? p.days_to_harvest > 0 ? `เก็บใน ${p.days_to_harvest} วัน` : 'พร้อมเก็บเกี่ยว'
        : 'ไม่ระบุ';

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 12,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });

      marker.bindTooltip(
        `<strong>${p.crop_name}</strong><br/>${p.plot_name} · ${p.member_name}<br/>${harvestText}<br/>~${(p.estimated_yield_kg ?? 0).toLocaleString()} กก.`,
        { permanent: false, direction: 'top', className: 'leaflet-tooltip' }
      );

      marker.on('click', () => onSelect(p));
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [plots, colorMap, onSelect]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: 500, borderRadius: 14, border: '1px solid #e8ede8', overflow: 'hidden' }}
    />
  );
}
