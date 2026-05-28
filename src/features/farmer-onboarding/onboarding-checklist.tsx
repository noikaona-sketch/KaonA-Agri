'use client';

import Link       from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────
type StepKey = 'plot' | 'cycle' | 'no_burn' | 'seed';

type Step = {
  key:    StepKey;
  icon:   string;
  label:  string;
  desc:   string;
  href:   string;
  done:   boolean;
};

type Counts = Record<StepKey, number>;

// ─── Helpers ─────────────────────────────────────────────────────────
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ background: '#E5E7EB', borderRadius: 99, height: 6, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#639922', borderRadius: 99, transition: 'width .4s ease' }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────
export function OnboardingChecklist({ memberId }: { memberId: string }) {
  const [counts,  setCounts]  = useState<Counts | null>(null);
  const [hidden,  setHidden]  = useState(false);

  useEffect(() => {
    if (!memberId) return;
    const s = createSupabaseBrowserClient();
    void (async () => {
      const [plotRes, cycleRes, burnRes, seedRes] = await Promise.all([
        s.from('plots').select('id', { count: 'exact', head: true }).eq('member_id', memberId).is('deleted_at', null),
        s.from('planting_cycles').select('id', { count: 'exact', head: true }).eq('member_id', memberId),
        s.from('no_burn_requests').select('id', { count: 'exact', head: true }).eq('member_id', memberId),
        s.from('seed_reservations').select('id', { count: 'exact', head: true }).eq('member_id', memberId),
      ]);
      setCounts({
        plot:    plotRes.count  ?? 0,
        cycle:   cycleRes.count ?? 0,
        no_burn: burnRes.count  ?? 0,
        seed:    seedRes.count  ?? 0,
      });
    })();
  }, [memberId]);

  if (!counts) return null;

  const steps: Step[] = [
    { key: 'plot',    icon: '🗺️', label: 'ลงทะเบียนแปลง',    desc: 'บันทึกพื้นที่แปลงของคุณ',      href: '/plots/add',              done: counts.plot    > 0 },
    { key: 'cycle',   icon: '🌱', label: 'สร้างรอบปลูก',      desc: 'แจ้งข้อมูลการปลูกรอบแรก',     href: '/planting-cycles/new',    done: counts.cycle   > 0 },
    { key: 'no_burn', icon: '🔥', label: 'สมัครโครงการไม่เผา', desc: 'รับโบนัส +100 บาท/ตัน',       href: '/no-burn',                done: counts.no_burn > 0 },
    { key: 'seed',    icon: '🌽', label: 'จองเมล็ดพันธุ์',     desc: 'จองเมล็ดสำหรับรอบปลูกหน้า',  href: '/service/reservations',   done: counts.seed    > 0 },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone   = doneCount === steps.length;

  // ซ่อนทันทีเมื่อทำครบหรือ user กด dismiss
  if (allDone || hidden) return null;

  return (
    <div style={{ background: '#FAFFF5', borderRadius: 16, border: '1px solid #C0DD97', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 2px', fontWeight: 500, fontSize: 14, color: '#27500A' }}>
            ยินดีต้อนรับ! เริ่มต้นใช้งาน 🎉
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#3B6D11' }}>
            {doneCount}/{steps.length} ขั้นตอน
          </p>
          <ProgressBar done={doneCount} total={steps.length} />
        </div>
        <button onClick={() => setHidden(true)}
          style={{ marginLeft: 12, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af', flexShrink: 0, lineHeight: 1 }}>
          ✕
        </button>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderTop: '1px solid #E5EDDA' }}>
        {steps.map((step, i) => (
          <Link key={step.key} href={step.done ? '#' : step.href}
            style={{ textDecoration: 'none', pointerEvents: step.done ? 'none' : 'auto' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
              background: step.done ? '#F0FFF0' : '#fff',
              borderBottom: i < steps.length - 1 ? '1px solid #F0F4EB' : 'none',
              opacity: step.done ? 0.7 : 1,
            }}>
              {/* status circle */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                background: step.done ? '#639922' : '#F0F4EB',
                color: step.done ? '#fff' : '#9ca3af',
                fontWeight: 700,
              }}>
                {step.done ? '✓' : i + 1}
              </div>

              {/* text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: step.done ? '#27500A' : '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {step.icon} {step.label}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: '#6b7280' }}>{step.desc}</p>
              </div>

              {/* arrow / done */}
              {!step.done && <span style={{ color: '#639922', fontSize: 18, flexShrink: 0 }}>›</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
