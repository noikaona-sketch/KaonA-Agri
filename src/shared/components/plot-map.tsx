'use client';

import { useEffect, useRef, useState } from 'react';

/* ── Types ── */
export type PlotData = {
  id: string; name: string; area_rai: number;
  lat: number | null; lng: number | null; accuracy: number | null;
  province: string | null; district: string | null; sub_district: string | null;
  land_doc_type: string | null; description: string | null;
  boundary_geojson: object | null; area_rai_calculated: number | null;
  member?: { id:string; full_name:string; phone:string|null } | null;
};

type Props = {
  plots:       PlotData[];
  selectedId?: string | null;
  onSelect?:   (id: string) => void;
  editMode?:   boolean;           // เปิดโหมดวาด polygon
  onSaveBoundary?: (plotId:string, geojson:object, areaRai:number) => Promise<void>;
  height?:     number;
};

declare global {
  interface Window {
    google: typeof google;
    initPlotsMap?: () => void;
  }
}

/* ── helpers ── */
function calcAreaRai(path: google.maps.LatLng[]): number {
  const areaM2 = google.maps.geometry.spherical.computeArea(path);
  return Math.round((areaM2 / 1600) * 100) / 100; // 1 ไร่ = 1600 m²
}

function geojsonToPath(geojson: { coordinates?: number[][][] }): google.maps.LatLngLiteral[] {
  if (!geojson?.coordinates?.[0]) return [];
  return geojson.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
}

const PLOT_COLORS = [
  '#2D6A4F','#40916C','#1B4332','#52B788','#74C69D',
  '#F4A261','#E76F51','#2563EB','#7C3AED','#DC2626',
];

/* ── Component ── */
export function PlotMap({ plots, selectedId, onSelect, editMode, onSaveBoundary, height=480 }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapObj     = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const polygonsRef= useRef<Map<string, google.maps.Polygon>>(new Map());
  const drawingRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const drawPoly   = useRef<google.maps.Polygon | null>(null);

  const [mapLoaded,   setMapLoaded]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [drawingPlot, setDrawingPlot] = useState<string|null>(null);
  const [pendingArea, setPendingArea] = useState<number|null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  /* ── Load Google Maps ── */
  useEffect(() => {
    if (!apiKey || mapLoaded || window.google?.maps) { setMapLoaded(true); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry&callback=initPlotsMap`;
    script.async = true;
    window.initPlotsMap = () => setMapLoaded(true);
    document.head.appendChild(script);
    return () => { delete window.initPlotsMap; };
  }, [apiKey, mapLoaded]);

  /* ── Init map ── */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapObj.current) return;
    // หา center จากแปลงที่มี GPS
    const withGPS = plots.filter(p => p.lat && p.lng);
    const center  = withGPS.length
      ? { lat: withGPS[0].lat!, lng: withGPS[0].lng! }
      : { lat: 15.0, lng: 102.0 }; // default กลางไทย

    mapObj.current = new google.maps.Map(mapRef.current, {
      center, zoom: withGPS.length ? 14 : 6,
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [{ featureType:'poi', stylers:[{visibility:'off'}] }],
    });
  }, [mapLoaded, plots]);

  /* ── Render markers + polygons ── */
  useEffect(() => {
    if (!mapObj.current || !mapLoaded) return;
    const map = mapObj.current;

    // ล้างของเดิม
    markersRef.current.forEach(m => m.setMap(null));
    polygonsRef.current.forEach(p => p.setMap(null));
    markersRef.current.clear();
    polygonsRef.current.clear();

    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;

    plots.forEach((plot, idx) => {
      const color = PLOT_COLORS[idx % PLOT_COLORS.length];
      const isSelected = plot.id === selectedId;

      // ── GPS Marker ──
      if (plot.lat && plot.lng) {
        const pos = { lat: plot.lat, lng: plot.lng };
        bounds.extend(pos);
        hasPoint = true;

        const marker = new google.maps.Marker({
          position: pos, map,
          title: plot.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isSelected ? 12 : 8,
            fillColor: color, fillOpacity: 1,
            strokeColor: '#fff', strokeWeight: 2,
          },
          zIndex: isSelected ? 10 : 1,
        });

        const infoContent = `
          <div style="font-family:Sarabun,sans-serif;padding:4px;min-width:160px">
            <p style="margin:0 0 4px;font-weight:700;font-size:14px">${plot.name}</p>
            <p style="margin:0 0 2px;font-size:12px;color:#6B7280">${plot.area_rai} ไร่ · ${plot.province ?? '—'}</p>
            ${plot.member ? `<p style="margin:0;font-size:11px;color:#9CA3AF">👤 ${plot.member.full_name}</p>` : ''}
            ${plot.area_rai_calculated ? `<p style="margin:4px 0 0;font-size:11px;color:#7C3AED">📐 วัดได้ ${plot.area_rai_calculated} ไร่</p>` : ''}
          </div>`;
        const info = new google.maps.InfoWindow({ content: infoContent });
        marker.addListener('click', () => {
          info.open(map, marker);
          onSelect?.(plot.id);
        });
        markersRef.current.set(plot.id, marker);
      }

      // ── Polygon boundary ──
      if (plot.boundary_geojson) {
        const path = geojsonToPath(plot.boundary_geojson as { coordinates?: number[][][] });
        if (path.length > 2) {
          path.forEach(p => bounds.extend(p));
          hasPoint = true;
          const poly = new google.maps.Polygon({
            paths: path, map,
            strokeColor: color, strokeWeight: isSelected ? 3 : 2, strokeOpacity: 0.9,
            fillColor: color, fillOpacity: isSelected ? 0.3 : 0.15,
            clickable: true, zIndex: isSelected ? 5 : 1,
          });
          poly.addListener('click', () => onSelect?.(plot.id));
          polygonsRef.current.set(plot.id, poly);
        }
      }
    });

    if (hasPoint && plots.length > 0) {
      map.fitBounds(bounds, 60);
      if (plots.length === 1) map.setZoom(15);
    }
  }, [mapLoaded, plots, selectedId, onSelect]);

  /* ── Drawing Manager ── */
  useEffect(() => {
    if (!mapObj.current || !mapLoaded) return;
    if (!editMode) {
      drawingRef.current?.setMap(null);
      drawingRef.current = null;
      drawPoly.current?.setMap(null);
      return;
    }

    const dm = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        strokeColor: '#F4A261', strokeWeight: 3,
        fillColor: '#F4A261', fillOpacity: 0.2,
        editable: true, draggable: true,
      },
    });
    dm.setMap(mapObj.current);
    drawingRef.current = dm;

    dm.addListener('polygoncomplete', (polygon: google.maps.Polygon) => {
      drawPoly.current?.setMap(null);
      drawPoly.current = polygon;
      dm.setDrawingMode(null);
      const path = polygon.getPath().getArray();
      const area = calcAreaRai(path);
      setPendingArea(area);
    });
  }, [mapLoaded, editMode]);

  /* ── Save boundary ── */
  async function saveBoundary() {
    if (!drawPoly.current || !drawingPlot || !onSaveBoundary) return;
    const path = drawPoly.current.getPath().getArray();
    const coords = [...path, path[0]].map(p => [p.lng(), p.lat()]);
    const geojson = { type:'Polygon', coordinates:[coords] };
    const area    = calcAreaRai(path);
    setSaving(true);
    await onSaveBoundary(drawingPlot, geojson, area);
    setSaving(false);
    drawPoly.current.setMap(null);
    drawPoly.current = null;
    setPendingArea(null);
    setDrawingPlot(null);
  }

  if (!apiKey) return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', background:'#F3F4F6', borderRadius:10, color:'#9CA3AF', fontSize:13 }}>
      ⚠️ ไม่พบ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    </div>
  );

  return (
    <div style={{ position:'relative' }}>
      {/* Drawing controls overlay */}
      {editMode && (
        <div style={{ position:'absolute', top:8, right:8, zIndex:10, display:'flex', flexDirection:'column', gap:6 }}>
          {plots.length > 0 && (
            <select value={drawingPlot ?? ''} onChange={e => setDrawingPlot(e.target.value || null)}
              style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:12, background:'#fff', maxWidth:180 }}>
              <option value="">เลือกแปลงที่จะวาด…</option>
              {plots.map(p => <option key={p.id} value={p.id}>{p.name} ({p.area_rai} ไร่)</option>)}
            </select>
          )}
          {pendingArea !== null && drawingPlot && (
            <div style={{ background:'#fff', borderRadius:8, padding:'8px 12px', border:'1px solid #E5E7EB', fontSize:12 }}>
              <p style={{ margin:'0 0 4px', fontWeight:600, color:'#111' }}>📐 วัดได้ {pendingArea} ไร่</p>
              <p style={{ margin:'0 0 6px', fontSize:11, color:'#9CA3AF' }}>farmer กรอก: {plots.find(p=>p.id===drawingPlot)?.area_rai} ไร่</p>
              <button onClick={saveBoundary} disabled={saving}
                style={{ width:'100%', padding:'5px', borderRadius:6, border:'none', background:'#2D6A4F', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                {saving ? '⏳ กำลังบันทึก…' : '💾 บันทึก polygon'}
              </button>
            </div>
          )}
        </div>
      )}

      {!mapLoaded && (
        <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', background:'#F0FDF4', borderRadius:10, color:'#6B7280', fontSize:13 }}>
          ⏳ กำลังโหลดแผนที่…
        </div>
      )}
      <div ref={mapRef} style={{ height, borderRadius:10, display: mapLoaded?'block':'none', overflow:'hidden' }} />
    </div>
  );
}
