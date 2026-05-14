'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

export type FieldMarker = {
  id: string;
  type: 'self' | 'member' | 'plot';
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  phone?: string | null;
};

type Props = {
  markers: FieldMarker[];
  selfLat?: number | null;
  selfLng?: number | null;
};

const COLORS: Record<FieldMarker['type'], string> = {
  self:   '#1b5e20',
  member: '#1565c0',
  plot:   '#e65100',
};

const ICONS: Record<FieldMarker['type'], string> = {
  self:   '📍',
  member: '👤',
  plot:   '🌾',
};

export default function FieldTeamMapInner({ markers, selfLat, selfLng }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    // Fix Leaflet default icon
    const proto = L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown };
    delete proto._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const center: [number, number] = selfLat && selfLng
      ? [selfLat, selfLng]
      : markers.length > 0
      ? [markers[0].lat, markers[0].lng]
      : [15.0, 102.0]; // default Thailand center

    const map = L.map(ref.current, { zoomControl: true }).setView(center, 13);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    // แสดง marker ตัวเอง
    if (selfLat && selfLng) {
      const selfIcon = L.divIcon({
        html: `<div style="background:#1b5e20;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });
      L.marker([selfLat, selfLng], { icon: selfIcon })
        .bindPopup('<b>📍 ตำแหน่งของคุณ</b>')
        .addTo(map);
    }

    // แสดง markers อื่น
    markers.forEach((m) => {
      const color = COLORS[m.type];
      const icon  = ICONS[m.type];
      const markerIcon = L.divIcon({
        html: `<div style="background:${color};color:#fff;border-radius:50% 50% 50% 0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${icon}</span></div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const gmapsUrl = `https://maps.google.com/?q=${m.lat},${m.lng}`;
      const phoneBtn = m.phone
        ? `<br><a href="tel:${m.phone}" style="color:#1b5e20;font-weight:700">📞 โทร ${m.phone}</a>`
        : '';
      const navBtn = `<br><a href="${gmapsUrl}" target="_blank" style="color:#1565c0;font-weight:700">🗺️ นำทาง Google Maps</a>`;

      L.marker([m.lat, m.lng], { icon: markerIcon })
        .bindPopup(`<b>${m.label}</b>${m.sublabel ? `<br><span style="color:#666;font-size:12px">${m.sublabel}</span>` : ''}${phoneBtn}${navBtn}`)
        .addTo(map);
    });

    // fit bounds ถ้ามี markers
    const allPoints: [number, number][] = [];
    if (selfLat && selfLng) allPoints.push([selfLat, selfLng]);
    markers.forEach((m) => allPoints.push([m.lat, m.lng]));
    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] });
    }

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  return <div ref={ref} style={{ width: '100%', height: '100%', minHeight: 340, borderRadius: 16 }} />;
}
