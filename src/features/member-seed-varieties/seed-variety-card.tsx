'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type PlantingStep = {
  day: string; title: string; description: string; icon: string;
};

export type SeedVarietyDetail = {
  id: string;
  variety_name: string;
  crop_type: string;
  days_to_harvest: number | null;
  seed_per_rai_kg: number | null;
  yield_per_rai: number | null;
  yield_ratio: number | null;
  planting_spacing: string | null;
  season: string | null;
  notes: string | null;
  planting_guide: string | null;
  planting_steps: PlantingStep[] | null;
  mentor_name: string | null;
  mentor_phone: string | null;
  price_per_bag: number | null;
  bag_weight_kg: number | null;
  seed_suppliers: { supplier_name: string }[] | null;
};

type Props = {
  variety: SeedVarietyDetail;
  onSelect?: () => void;
  selectLabel?: string;
};

export function SeedVarietyCard({ variety: v, onSelect, selectLabel }: Props) {
  const [showSteps, setShowSteps] = useState(false);
  const steps = v.planting_steps ?? [];

  return (
    <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid #e4ebe4', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      {/* header */}
      <div style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff', padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{v.variety_name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>{v.crop_type}</p>
          </div>
          {v.days_to_harvest && (
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 14, padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>{v.days_to_harvest}</p>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.85 }}>วัน</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* supplier + mentor */}
        {v.seed_suppliers?.[0] && (
          <div style={{ background: '#e3f2fd', borderRadius: 12, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1565c0' }}>🏪 ผู้ขายเมล็ดพันธุ์</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#1a237e' }}>{v.seed_suppliers[0].supplier_name}</p>
          </div>
        )}
        {v.mentor_name && (
          <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#2e7d32' }}>👨‍🌾 พี่เลี้ยง / เจ้าหน้าที่</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#1b5e20' }}>{v.mentor_name}</p>
            </div>
            {v.mentor_phone && (
              <a href={`tel:${v.mentor_phone}`}
                style={{ width: 40, height: 40, borderRadius: '50%', background: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 18, flexShrink: 0 }}>
                📞
              </a>
            )}
          </div>
        )}

        {/* key stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[
            { icon: '📅', label: 'เก็บเกี่ยว', value: v.days_to_harvest ? `${v.days_to_harvest} วัน` : '—' },
            { icon: '📦', label: 'ผลผลิต', value: v.yield_per_rai ? `${v.yield_per_rai} ตัน/ไร่` : '—' },
            { icon: '🌾', label: 'เมล็ด/ไร่', value: v.seed_per_rai_kg ? `${v.seed_per_rai_kg} กก.` : '—' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#f7faf7', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18 }}>{s.icon}</p>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700 }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* spacing + season */}
        {v.planting_spacing && (
          <div style={{ background: '#fff8e1', borderRadius: 12, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#e65100' }}>📐 ระยะปลูก</p>
            <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: '#bf360c' }}>{v.planting_spacing}</p>
            {v.season && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#e65100' }}>ฤดูกาล: {v.season}</p>}
          </div>
        )}

        {/* notes */}
        {v.notes && (
          <div style={{ background: '#f3e5f5', borderRadius: 12, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#7b1fa2' }}>💡 คำแนะนำ</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4a148c', lineHeight: 1.6 }}>{v.notes}</p>
          </div>
        )}

        {/* planting steps accordion */}
        {steps.length > 0 && (
          <div style={{ border: '1px solid #e4ebe4', borderRadius: 14, overflow: 'hidden' }}>
            <button
              onClick={() => setShowSteps(!showSteps)}
              style={{ width: '100%', padding: '12px 16px', background: '#f7faf7', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 14 }}>
              <span>📋 ขั้นตอนการปลูก ({steps.length} ขั้นตอน)</span>
              <span style={{ fontSize: 18, transition: 'transform 0.2s', transform: showSteps ? 'rotate(180deg)' : 'none' }}>⌄</span>
            </button>
            {showSteps && (
              <div style={{ padding: '0 4px 8px' }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderTop: i === 0 ? '1px solid #e4ebe4' : 'none' }}>
                    {/* timeline dot */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: i === steps.length - 1 ? '#2e7d32' : '#e8f5e9', border: '2px solid #a5d6a7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {step.icon}
                      </div>
                      {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: '#e4ebe4', margin: '2px 0' }} />}
                    </div>
                    <div style={{ paddingBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{step.day}</p>
                      <p style={{ margin: '2px 0', fontSize: 14, fontWeight: 700 }}>{step.title}</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* select button */}
        {onSelect && (
          <button onClick={onSelect}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#2e7d32', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            {selectLabel ?? '✓ เลือกพันธุ์นี้สำหรับแจ้งปลูก →'}
          </button>
        )}
      </div>
    </div>
  );
}
