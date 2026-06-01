'use client';

import Link     from 'next/link';
import { useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember }               from '@/providers/auth-provider';
import { MobileAppShell }                 from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }                 from '@/shared/components/protected-route';

// ─── Types ────────────────────────────────────────────────────────────────────

type Plot = { id: string; name: string; area_rai: number | null; province: string | null };

// ─── Constants ────────────────────────────────────────────────────────────────

// ค่าเฉลี่ยธาตุอาหารที่สูญเสียจากการเผา 1 ไร่ (กก.)
// อ้างอิง: กรมวิชาการเกษตร / ไทยรัฐ
const NUTRIENT_PER_RAI = { n: 2.25, p: 0.50, k: 6.50 }; // กก./ไร่
const FERTILIZER_PRICE = { n: 30, p: 45, k: 18 };       // บาท/กก. (ปุ๋ยเดี่ยว เฉลี่ย 2567)

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  section: {
    background: '#fff',
    border: '1px solid var(--border,#d8e0db)',
    borderRadius: 14,
    padding: '16px',
    display: 'grid',
    gap: 12,
  } as React.CSSProperties,
  h2: { margin: 0, fontSize: 15, fontWeight: 800 } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 } as React.CSSProperties,
  badge: (bg: string, color: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
    background: bg, color,
  }),
};

// ─── Calculator ───────────────────────────────────────────────────────────────

function NutrientBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary,#4e5a53)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color, transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}

function Calculator({ plots }: { plots: Plot[] }) {
  const [selectedPlot, setSelectedPlot] = useState('');
  const [manualRai,    setManualRai]    = useState('');

  const plot  = plots.find((p) => p.id === selectedPlot);
  const rai   = plot?.area_rai ?? (manualRai ? Number(manualRai) : 0);

  // คำนวณธาตุอาหารที่จะได้คืน
  const nKg   = Math.round(rai * NUTRIENT_PER_RAI.n * 10) / 10;
  const pKg   = Math.round(rai * NUTRIENT_PER_RAI.p * 10) / 10;
  const kKg   = Math.round(rai * NUTRIENT_PER_RAI.k * 10) / 10;
  const savingBaht = Math.round(nKg * FERTILIZER_PRICE.n + pKg * FERTILIZER_PRICE.p + kKg * FERTILIZER_PRICE.k);

  // คิดเป็น % ของปุ๋ยที่ต้องซื้อ (สมมติใช้ปุ๋ย ~1,200 บาท/ไร่/รอบ)
  const fertPct = Math.min(Math.round((savingBaht / (rai * 1200)) * 100), 60);

  const hasResult = rai > 0;

  return (
    <div style={S.section}>
      <p style={S.h2}>🧮 คำนวณสิ่งที่คุณได้คืน</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary,#4e5a53)', lineHeight: 1.5 }}>
        ถ้าไม่เผาตอซัง แปลงของคุณจะได้รับธาตุอาหารกลับคืนเท่าไร?
      </p>

      {plots.length > 0 && (
        <label style={{ display: 'grid', gap: 5, fontSize: 13, fontWeight: 600 }}>
          เลือกแปลง
          <select
            value={selectedPlot}
            onChange={(e) => setSelectedPlot(e.target.value)}
            style={{ padding: '9px 12px', border: '1.5px solid var(--border,#d8e0db)', borderRadius: 10, fontSize: 14, background: '#fff' }}>
            <option value="">— เลือกแปลงของฉัน —</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.area_rai ? `(${p.area_rai} ไร่)` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {!selectedPlot && (
        <label style={{ display: 'grid', gap: 5, fontSize: 13, fontWeight: 600 }}>
          {plots.length > 0 ? 'หรือกรอกเองด้านล่าง' : 'พื้นที่แปลง (ไร่)'}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min="0.5" step="0.5" inputMode="decimal"
              value={manualRai}
              onChange={(e) => setManualRai(e.target.value)}
              placeholder="เช่น 5"
              style={{ flex: 1, padding: '9px 12px', border: '1.5px solid var(--border,#d8e0db)', borderRadius: 10, fontSize: 14, background: '#fff' }} />
            <span style={{ fontSize: 14, color: 'var(--text-secondary,#4e5a53)' }}>ไร่</span>
          </div>
        </label>
      )}

      {hasResult && (
        <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
          {/* Result headline */}
          <div style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', borderRadius: 12, padding: '14px 16px', color: '#fff', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 12, opacity: .8 }}>ประหยัดต้นทุนปุ๋ยได้ประมาณ</p>
            <p style={{ margin: '4px 0', fontSize: 32, fontWeight: 900 }}>~{savingBaht.toLocaleString()}</p>
            <p style={{ margin: 0, fontSize: 13, opacity: .85 }}>บาท/รอบ ({rai} ไร่)</p>
          </div>

          {/* Nutrients */}
          <div style={{ display: 'grid', gap: 8, padding: '12px', background: '#f0fdf4', borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#14532d' }}>ธาตุอาหารที่ดินได้คืน</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { icon: '🌿', label: 'N (ไนโตรเจน)', kg: nKg, color: '#059669' },
                { icon: '🔴', label: 'P (ฟอสฟอรัส)', kg: pKg, color: '#dc2626' },
                { icon: '🟡', label: 'K (โพแทสเซียม)', kg: kKg, color: '#d97706' },
              ].map((n) => (
                <div key={n.label} style={{ background: '#fff', borderRadius: 8, padding: '8px', textAlign: 'center', border: `1px solid ${n.color}33` }}>
                  <p style={{ margin: 0, fontSize: 16 }}>{n.icon}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: n.color }}>{n.kg}</p>
                  <p style={{ margin: 0, fontSize: 9, color: 'var(--text-secondary,#4e5a53)', lineHeight: 1.3 }}>กก.</p>
                  <p style={{ margin: '3px 0 0', fontSize: 9, color: 'var(--text-secondary,#4e5a53)', lineHeight: 1.3 }}>{n.label.replace(/.*\(/, '').replace(')', '')}</p>
                </div>
              ))}
            </div>
            {fertPct > 0 && (
              <NutrientBar
                label={`ลดการซื้อปุ๋ยได้ ~${fertPct}% ของต้นทุนปุ๋ย/รอบ`}
                pct={fertPct}
                color="#2e7d32" />
            )}
          </div>

          {/* Extra benefits */}
          <div style={{ display: 'grid', gap: 6 }}>
            {[
              { icon: '💧', label: 'ดินอุ้มน้ำดีขึ้น', detail: 'ลดรดน้ำ ประหยัดค่าแรง/ค่าไฟ' },
              { icon: '🪱', label: 'จุลินทรีย์ดินเพิ่ม', detail: 'ดินร่วนซุย ต้นโตเร็วขึ้น' },
              { icon: '🌬️', label: 'อากาศสะอาด', detail: 'ลด PM2.5 ในชุมชน' },
            ].map((b) => (
              <div key={b.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f7f9f7', borderRadius: 9, padding: '9px 12px' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{b.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{b.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary,#4e5a53)' }}>{b.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Why section ─────────────────────────────────────────────────────────────

function WhySection() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg,#1b5e20 0%,#2e7d32 60%,#388e3c 100%)', borderRadius: 16, padding: '20px 18px', color: '#fff' }}>
        <p style={{ margin: 0, fontSize: 11, opacity: .75, fontWeight: 600, letterSpacing: 1 }}>เผาทิ้ง = เผาปุ๋ยทิ้ง</p>
        <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 900, lineHeight: 1.3 }}>ทุกไร่ที่ไม่เผา<br />คือเงินที่คืนให้คุณ</p>
        <p style={{ margin: '10px 0 0', fontSize: 13, opacity: .85, lineHeight: 1.6 }}>
          การเผาตอซังทำให้ดินสูญเสียธาตุอาหาร N-P-K<br />
          มูลค่ากว่า <strong style={{ color: '#a5d6a7' }}>5,000 ล้านบาท</strong> ต่อปีทั่วประเทศ
        </p>
      </div>

      {/* 3-point why */}
      {[
        {
          icon: '💰', title: 'ได้โบนัสราคา',
          body: 'รับโบนัสพิเศษตามรอบที่ประกาศ เมื่อผ่านการตรวจแปลง',
          badge: { label: 'ทันทีที่อนุมัติ', bg: '#f0fdf4', color: '#14532d' },
        },
        {
          icon: '🪱', title: 'ลดต้นทุนปุ๋ย',
          body: 'ตอซังที่ไถกลบจะปล่อยธาตุอาหาร N P K คืนดินตามธรรมชาติ — ซื้อปุ๋ยน้อยลงในรอบถัดไป',
          badge: { label: '200–500 บ./ไร่', bg: '#f0fdf4', color: '#14532d' },
        },
        {
          icon: '🌾', title: 'ดินดี ผลผลิตดีขึ้น',
          body: 'อินทรียวัตถุที่เพิ่มขึ้นทำให้ดินร่วนซุย อุ้มน้ำได้ดี รากลึก ต้นแข็งแรง',
          badge: { label: 'สะสมทุกรอบ', bg: '#eff6ff', color: '#1d4ed8' },
        },
      ].map((item) => (
        <div key={item.title} style={{ ...S.section, flexDirection: 'row' as const, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={S.row}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{item.title}</p>
              <span style={S.badge(item.badge.bg, item.badge.color)}>{item.badge.label}</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary,#4e5a53)', lineHeight: 1.6 }}>
              {item.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NoBurnWhyPage() {
  const member = useCurrentMember();
  const [plots, setPlots] = useState<Plot[]>([]);

  useEffect(() => {
    if (!member?.member_id) return;
    const s = tryCreateSupabaseBrowserClient();
    if (!s) return;
    void s.from('plots')
      .select('id,name,area_rai,province')
      .eq('member_id', member.member_id)
      .eq('status', 'active')
      .then(({ data }) => setPlots((data as Plot[]) ?? []));
  }, [member?.member_id]);

  return (
    <ProtectedRoute allowedRoles={['farmer','staff','inspector','leader','admin']}>
      <MobileAppShell title="ทำไมต้องไม่เผา?" subtitle="ประโยชน์ที่คุณได้รับจริงๆ">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>

          <Link href="/no-burn" style={{ color: 'var(--primary,#2e7d32)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            ← กลับ
          </Link>

          <WhySection />
          <Calculator plots={plots} />

          {/* CTA */}
          <Link href="/no-burn" style={{
            display: 'block', textAlign: 'center', padding: '14px',
            background: 'var(--primary,#2e7d32)', color: '#fff',
            borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none',
          }}>
            🌿 สมัครโครงการไม่เผาเลย →
          </Link>

          {/* Source note */}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary,#4e5a53)', textAlign: 'center', lineHeight: 1.8 }}>
            ข้อมูลอ้างอิง: กรมวิชาการเกษตร · ไทยรัฐ · Bangkok Biz News<br />
            ค่าธาตุอาหารคำนวณจากค่าเฉลี่ยข้าวโพดไร่ ปี 2567
          </p>
        </div>
      </MobileAppShell>
    </ProtectedRoute>
  );
}
