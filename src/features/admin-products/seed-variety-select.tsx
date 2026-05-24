'use client';
import { useEffect, useState } from 'react';

export type SeedVariety = {
  id: string; variety_name: string; crop_type: string;
  days_to_harvest: number | null; seed_per_rai_kg: number | null;
  planting_spacing: string | null; season: string | null;
  bag_weight_kg: number | null; price_per_bag: number | null;
};

type Props = { value: string; onChange: (id: string, v: SeedVariety | null) => void; required?: boolean };

export function SeedVarietySelect({ value, onChange, required }: Props) {
  const [list,    setList]    = useState<SeedVariety[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/admin/seed-varieties?active=true', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { varieties?: SeedVariety[] }) => { setList(d.varieties ?? []); setLoading(false); });
  }, []);

  const sel = list.find((v) => v.id === value) ?? null;

  return (
    <label className="reg-label" style={{ gridColumn: '1/-1' }}>
      พันธุ์เมล็ด {required && <span className="reg-required">*</span>}
      <select className="reg-input" value={value}
        onChange={(e) => onChange(e.target.value, list.find((v) => v.id === e.target.value) ?? null)}
        disabled={loading}>
        <option value="">— {loading ? 'กำลังโหลด…' : 'เลือกพันธุ์เมล็ด'} —</option>
        {list.map((v) => <option key={v.id} value={v.id}>{v.variety_name} · {v.crop_type}</option>)}
      </select>
      {sel && (
        <div style={{ marginTop: 6, background: '#e8f5e9', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#2e7d32', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {sel.crop_type        && <span>🌿 {sel.crop_type}</span>}
          {sel.days_to_harvest  && <span>📅 {sel.days_to_harvest} วัน</span>}
          {sel.bag_weight_kg    && <span>⚖️ {sel.bag_weight_kg} กก./ถุง</span>}
          {sel.planting_spacing && <span>📐 {sel.planting_spacing}</span>}
          {sel.season           && <span>🌤 {sel.season}</span>}
        </div>
      )}
    </label>
  );
}
