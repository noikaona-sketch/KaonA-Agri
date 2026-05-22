'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type CycleReport = {
  id: string; crop_name: string; season_year: number; status: string;
  area_planted_rai: number; actual_yield_kg: number | null; estimated_yield_kg: number | null;
  total_qty_sold_kg: number; burn_practice: string; no_burn_approved: boolean;
  cost_per_rai: number; total_cost: number; expected_price_per_kg: number;
  estimated_revenue: number; estimated_profit: number;
  cost_saving_from_no_burn: number | null;
  sales: { appointment_date: string; actual_qty_kg: number | null; pickup_location_name: string | null }[];
};
type Summary = {
  total_cycles: number; total_area_rai: number; total_yield_kg: number;
  total_revenue: number; total_cost: number; total_profit: number;
  no_burn_cycles: number; total_no_burn_saving: number;
};

const BURN_LABEL: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  no_burn: { icon: '🌿', label: 'ไม่เผา', color: '#27500A', bg: '#EAF3DE' },
  burn:    { icon: '🔥', label: 'เผา',   color: '#791F1F', bg: '#FCEBEB' },
  partial: { icon: '⚡', label: 'เผาบางส่วน', color: '#633806', bg: '#FAEEDA' },
  unknown: { icon: '❓', label: 'ไม่ระบุ', color: '#444441', bg: '#F1EFE8' },
};

const fmt  = (n: number, d = 0) => n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtk = (n: number) => n >= 1000 ? `${fmt(n / 1000, 1)} ตัน` : `${fmt(n)} กก.`;

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: '42%', background: 'var(--color-background-secondary)', borderRadius: 12, padding: '12px 14px' }}>
      <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--color-text-secondary)' }}>{icon} {label}</p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: color ?? 'var(--color-text-primary)' }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-secondary)' }}>{sub}</p>}
    </div>
  );
}

export function MemberSeasonReport({ memberId }: { memberId: string }) {
  const [cycles,  setCycles]  = useState<CycleReport[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/member/my-report?member_id=${memberId}`);
      const d   = (await res.json()) as { cycles?: CycleReport[]; summary?: Summary };
      setCycles(d.cycles ?? []);
      setSummary(d.summary ?? null);
      setLoading(false);
    })();
  }, [memberId]);

  if (loading) return <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', padding: 24 }}>กำลังโหลด…</p>;
  if (cycles.length === 0) return <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', padding: 24 }}>ยังไม่มีข้อมูลรอบปลูก</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* สรุปรวม */}
      {summary && (
        <div className="kaona-card">
          <p style={{ margin: '0 0 10px', fontWeight: 500, fontSize: 14 }}>📊 สรุปทุกรอบปลูก</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <KpiCard icon="🌾" label="ผลผลิตรวม"    value={fmtk(summary.total_yield_kg)} sub={`${summary.total_cycles} รอบ · ${fmt(summary.total_area_rai, 1)} ไร่`} />
            <KpiCard icon="💰" label="รายได้รวม"    value={`฿${fmt(summary.total_revenue)}`} color="#1b5e20" />
            <KpiCard icon="📉" label="ต้นทุนรวม"    value={`฿${fmt(summary.total_cost)}`}    color="#c62828" />
            <KpiCard icon="✅" label="กำไรโดยประมาณ" value={`฿${fmt(summary.total_profit)}`}  color={summary.total_profit >= 0 ? '#1b5e20' : '#c62828'} />
          </div>
          {summary.no_burn_cycles > 0 && (
            <div style={{ marginTop: 10, background: '#EAF3DE', borderRadius: 10, padding: '8px 12px' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#27500A', fontWeight: 500 }}>
                🌿 ไม่เผา {summary.no_burn_cycles} รอบ — ประหยัดต้นทุนรวม ~฿{fmt(summary.total_no_burn_saving)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* รายละเอียดรายรอบ */}
      {cycles.map((c) => {
        const burn = BURN_LABEL[c.burn_practice] ?? BURN_LABEL.unknown;
        const isOpen = open === c.id;
        const yieldKg = c.actual_yield_kg ?? c.total_qty_sold_kg;
        const yieldPerRai = c.area_planted_rai > 0 ? yieldKg / c.area_planted_rai : null;

        return (
          <div key={c.id} className="kaona-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div onClick={() => setOpen(isOpen ? null : c.id)} style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontWeight: 500, fontSize: 14 }}>
                  🌽 {c.crop_name} — ปี {c.season_year}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: burn.bg, color: burn.color, fontWeight: 500 }}>
                    {burn.icon} {burn.label}
                  </span>
                  {c.no_burn_approved && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#EAF3DE', color: '#27500A', fontWeight: 500 }}>
                      ✅ ผ่านโครงการไม่เผา
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{fmt(c.area_planted_rai, 1)} ไร่</span>
                </div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--color-text-secondary)', marginLeft: 8 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Quick numbers always visible */}
            <div style={{ display: 'flex', borderTop: '0.5px solid var(--color-border-tertiary)', borderBottom: isOpen ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
              {[
                { label: 'ผลผลิต',  value: fmtk(yieldKg) },
                { label: 'รายได้',  value: `฿${fmt(c.estimated_revenue)}`, color: '#1b5e20' },
                { label: 'ต้นทุน',  value: `฿${fmt(c.total_cost)}`,        color: '#c62828' },
                { label: 'กำไร',    value: `฿${fmt(c.estimated_profit)}`,   color: c.estimated_profit >= 0 ? '#1b5e20' : '#c62828' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: 1, padding: '8px 4px', textAlign: 'center', borderRight: '0.5px solid var(--color-border-tertiary)' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--color-text-secondary)' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: color ?? 'var(--color-text-primary)' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Detail (toggle) */}
            {isOpen && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* ผลผลิตและต้นทุน */}
                <div style={{ background: 'var(--color-background-secondary)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    { label: 'พื้นที่ปลูก',          value: `${fmt(c.area_planted_rai, 1)} ไร่` },
                    { label: 'ผลผลิตต่อไร่',         value: yieldPerRai ? `${fmt(yieldPerRai, 0)} กก./ไร่` : '—' },
                    { label: 'ต้นทุนต่อไร่',          value: c.cost_per_rai > 0 ? `฿${fmt(c.cost_per_rai)}` : 'ไม่ได้กรอก' },
                    { label: 'ราคาที่คาดไว้',         value: c.expected_price_per_kg > 0 ? `${c.expected_price_per_kg.toFixed(2)} บาท/กก.` : 'ไม่ได้กรอก' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* เปรียบเทียบเผา/ไม่เผา */}
                {c.cost_saving_from_no_burn !== null && (
                  <div style={{ background: c.cost_saving_from_no_burn > 0 ? '#EAF3DE' : '#FAEEDA', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 500, color: c.cost_saving_from_no_burn > 0 ? '#27500A' : '#633806' }}>
                      🌿 ผลของการ{c.burn_practice === 'no_burn' ? 'ไม่เผา' : 'เผา'}ตอซัง
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: c.cost_saving_from_no_burn > 0 ? '#27500A' : '#633806' }}>
                      {c.burn_practice === 'no_burn'
                        ? `ประหยัดต้นทุนได้ ~฿${fmt(c.cost_saving_from_no_burn)} เทียบกับเผา`
                        : `ถ้าไม่เผาจะประหยัดได้อีก ~฿${fmt(Math.abs(c.cost_saving_from_no_burn))}`
                      }
                    </p>
                  </div>
                )}

                {/* ประวัติการขาย */}
                {c.sales.length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 500 }}>📦 รอบการขาย</p>
                    {c.sales.map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {new Date(s.appointment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {s.pickup_location_name && ` · ${s.pickup_location_name}`}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{fmtk(s.actual_qty_kg ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        ⚠️ รายได้และกำไรเป็นการประมาณการจากข้อมูลที่กรอก ไม่ใช่ตัวเลขยืนยันจากโรงงาน
      </p>
    </div>
  );
}
