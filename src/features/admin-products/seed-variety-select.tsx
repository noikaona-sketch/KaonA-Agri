// src/features/admin-products/seed-variety-select.tsx
// Dropdown ที่โหลด seed_varieties และ auto-fill ข้อมูลเมล็ดเมื่อเลือก

'use client';

import { useEffect, useState } from 'react';

export type SeedVariety = {
  id: string;
  variety_name: string;
  crop_type: string;
  days_to_harvest: number | null;
  seed_per_rai_kg: number | null;
  planting_spacing: string | null;
  season: string | null;
  bag_weight_kg: number | null;
  price_per_bag: number | null;
};

type Props = {
  value: string;                          // seed_variety_id
  onChange: (id: string, variety: SeedVariety | null) => void;
  required?: boolean;
};

export function SeedVarietySelect({ value, onChange, required }: Props) {
  const [varieties, setVarieties] = useState<SeedVariety[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    void fetch('/api/admin/seed-varieties?active=true')
      .then((r) => r.json())
      .then((d: { varieties?: SeedVariety[] }) => {
        setVarieties(d.varieties ?? []);
        setLoading(false);
      });
  }, []);

  function handleChange(id: string) {
    const found = varieties.find((v) => v.id === id) ?? null;
    onChange(id, found);
  }

  return (
    <label className="reg-label" style={{ gridColumn: '1/-1' }}>
      พันธุ์เมล็ด {required && <span className="reg-required">*</span>}
      <select
        className="reg-input"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
      >
        <option value="">— {loading ? 'กำลังโหลด…' : 'เลือกพันธุ์เมล็ด'} —</option>
        {varieties.map((v) => (
          <option key={v.id} value={v.id}>
            {v.variety_name} · {v.crop_type}
          </option>
        ))}
      </select>
    </label>
  );
}
