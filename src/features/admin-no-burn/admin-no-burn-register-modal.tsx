'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Member = { id: string; full_name: string; phone: string | null };
type Plot   = { id: string; name: string; province: string | null };
type Cycle  = { id: string; crop_name: string; season_year: number };
type Timing = 'before_planting' | 'after_planting';

const TIMING_CFG: Record<Timing, { icon: string; label: string; sub: string }> = {
  before_planting: { icon: '🌱', label: 'ก่อนลงแปลง',     sub: 'ยังไม่ได้ปลูก' },
  after_planting:  { icon: '🌿', label: 'หลังลงแปลงแล้ว', sub: 'ปลูกแล้ว' },
};

type Props = { onClose: () => void; onSuccess: () => void };

export function AdminNoBurnRegisterModal({ onClose, onSuccess }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<'member' | 'plot' | 'timing' | 'confirm'>('member');

  // ── Data ────────────────────────────────────────────────────────────────────
  const [searchQ,    setSearchQ]    = useState('');
  const [members,    setMembers]    = useState<Member[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [selMember,  setSelMember]  = useState<Member | null>(null);

  const [plots,      setPlots]      = useState<Plot[]>([]);
  const [selPlot,    setSelPlot]    = useState<Plot | null>(null);

  const [cycles,     setCycles]     = useState<Cycle[]>([]);
  const [selCycle,   setSelCycle]   = useState('');
  const [timing,     setTiming]     = useState<Timing>('after_planting');
  const [note,       setNote]       = useState('');

  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Search members ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchQ.length < 2) { setMembers([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const sb = createSupabaseBrowserClient();
      const { data } = await sb.from('members')
        .select('id,full_name,phone')
        .eq('status', 'approved')
        .or(`full_name.ilike.%${searchQ}%,phone.ilike.%${searchQ}%`)
        .limit(8);
      setMembers((data as Member[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  // ── Load plots when member selected ────────────────────────────────────────
  async function selectMember(m: Member) {
    setSelMember(m); setSearchQ(''); setMembers([]);
    const sb = createSupabaseBrowserClient();
    const { data: p } = await sb.from('plots')
      .select('id,name,province')
      .eq('member_id', m.id).is('deleted_at', null);
    setPlots((p as Plot[]) ?? []);
    const { data: c } = await sb.from('planting_cycles')
      .select('id,crop_name,season_year')
      .eq('member_id', m.id)
      .not('status', 'in', '("harvested","cancelled")');
    setCycles((c as Cycle[]) ?? []);
    setStep('plot');
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submit() {
    if (!selMember || !selPlot) return;
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/no-burn/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:         selMember.id,
        plot_id:           selPlot.id,
        timing,
        planting_cycle_id: selCycle || null,
        note:              note.trim() || null,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok || json.error) { setError(json.error ?? 'บันทึกไม่สำเร็จ'); return; }
    onSuccess();
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480,
          maxHeight: '88vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        }}>

          {/* Header */}
          <div style={{
            padding: '18px 20px 14px', borderBottom: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>🌿 ลงทะเบียนงดเผา</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>ลงทะเบียนโครงการงดเผาแทนสมาชิก</p>
            </div>
            <button onClick={onClose} style={{
              background: '#f3f4f6', border: 'none', borderRadius: 8,
              width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6b7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {/* Step breadcrumb */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {(['member','plot','timing','confirm'] as const).map((s, i) => {
                const labels = ['สมาชิก','แปลง','จังหวะ','ยืนยัน'];
                const done = ['member','plot','timing','confirm'].indexOf(step) > i;
                const active = step === s;
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? '#2e7d32' : active ? '#2e7d32' : '#e5e7eb',
                      color: (done || active) ? '#fff' : '#9ca3af',
                    }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#2e7d32' : done ? '#2e7d32' : '#9ca3af' }}>
                      {labels[i]}
                    </span>
                    {i < 3 && <span style={{ color: '#d1d5db', fontSize: 12 }}>›</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FAEEDA', border: '1px solid #854F0B', color: '#633806', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>⚠️</span><span style={{ flex: 1 }}>{error}</span>
                <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
              </div>
            )}

            {/* ── STEP 1: member search ── */}
            {step === 'member' && (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>ค้นหาสมาชิก</p>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchRef} autoFocus
                    type="text" value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="พิมพ์ชื่อหรือเบอร์โทร…"
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12,
                      border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none',
                      boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#2e7d32'; }}
                    onBlur={(e)  => { e.target.style.borderColor = '#d1d5db'; }}
                  />
                  {searching && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>กำลังค้นหา…</span>
                  )}
                </div>

                {members.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {members.map((m) => (
                      <button key={m.id} onClick={() => selectMember(m)} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 14px', borderRadius: 12,
                        border: '1.5px solid #e5e7eb', background: '#fafafa',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e7d32'; (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = '#fafafa'; }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111' }}>{m.full_name}</p>
                          {m.phone && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m.phone}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQ.length >= 2 && !searching && members.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 16 }}>ไม่พบสมาชิก</p>
                )}
              </div>
            )}

            {/* ── STEP 2: select plot ── */}
            {step === 'plot' && selMember && (
              <div>
                <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>👤 {selMember.full_name}</p>
                  {selMember.phone && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{selMember.phone}</p>}
                </div>

                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>เลือกแปลง</p>

                {plots.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', background: '#fafafa', borderRadius: 12, border: '1px dashed #e0e0e0' }}>
                    <p style={{ margin: 0, fontSize: 32 }}>🗺️</p>
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: '#9ca3af' }}>สมาชิกยังไม่มีแปลงที่ลงทะเบียน</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plots.map((p) => (
                      <button key={p.id} onClick={() => { setSelPlot(p); setStep('timing'); }} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '13px 14px', borderRadius: 12,
                        border: '1.5px solid #e5e7eb', background: '#fafafa',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e7d32'; (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = '#fafafa'; }}
                      >
                        <span style={{ fontSize: 22 }}>🌾</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111' }}>{p.name}</p>
                          {p.province && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{p.province}</p>}
                        </div>
                        <span style={{ color: '#9ca3af', fontSize: 18 }}>›</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: timing ── */}
            {step === 'timing' && selMember && selPlot && (
              <div>
                <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>👤 {selMember.full_name} · 🌾 {selPlot.name}</p>
                </div>

                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>จะงดเผาตอนไหน?</p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {(['before_planting','after_planting'] as Timing[]).map((t) => {
                    const cfg = TIMING_CFG[t];
                    const sel = timing === t;
                    return (
                      <button key={t} onClick={() => { setTiming(t); if (t === 'before_planting') setSelCycle(''); }}
                        style={{
                          flex: 1, padding: '14px 12px', borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                          border: `2px solid ${sel ? '#2e7d32' : '#e5e7eb'}`,
                          background: sel ? '#f0fdf4' : '#fff',
                        }}>
                        <p style={{ margin: '0 0 4px', fontSize: 22 }}>{cfg.icon}</p>
                        <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 13, color: sel ? '#2e7d32' : '#111' }}>{cfg.label}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{cfg.sub}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Planting cycle */}
                {timing === 'after_planting' && cycles.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>รอบเพาะปลูก <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ไม่บังคับ)</span></p>
                    <div style={{ position: 'relative' }}>
                      <select value={selCycle} onChange={(e) => setSelCycle(e.target.value)}
                        style={{ width: '100%', padding: '11px 36px 11px 14px', borderRadius: 12, border: '1.5px solid #d1d5db', appearance: 'none', WebkitAppearance: 'none', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
                        <option value="">ไม่ระบุ</option>
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.crop_name} {c.season_year}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280', fontSize: 12 }}>▾</span>
                    </div>
                  </div>
                )}

                {/* Note */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>หมายเหตุ <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ไม่บังคับ)</span></p>
                  <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น สมาชิกแจ้งด้วยตนเอง ณ จุดรับซื้อ…"
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #d1d5db', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                    onFocus={(e) => { e.target.style.borderColor = '#2e7d32'; }}
                    onBlur={(e)  => { e.target.style.borderColor = '#d1d5db'; }}
                  />
                </div>

                <button onClick={() => setStep('confirm')}
                  style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                  ถัดไป →
                </button>
              </div>
            )}

            {/* ── STEP 4: confirm ── */}
            {step === 'confirm' && selMember && selPlot && (
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#374151' }}>ตรวจสอบข้อมูลก่อนบันทึก</p>
                <div style={{ background: '#f9fafb', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
                  {[
                    ['👤 สมาชิก', selMember.full_name + (selMember.phone ? ` · ${selMember.phone}` : '')],
                    ['🌾 แปลง',   selPlot.name + (selPlot.province ? ` · ${selPlot.province}` : '')],
                    ['⏱ จังหวะ',  TIMING_CFG[timing].icon + ' ' + TIMING_CFG[timing].label],
                    ...(selCycle ? [['🌿 รอบปลูก', cycles.find(c => c.id === selCycle)?.crop_name + ' ' + cycles.find(c => c.id === selCycle)?.season_year] as [string,string]] : []),
                    ...(note.trim() ? [['📝 หมายเหตุ', note.trim()] as [string,string]] : []),
                  ].map(([label, value], i, arr) => (
                    <div key={label} style={{ padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none', display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 80, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#E6F1FB', border: '1px solid #185FA5', marginBottom: 16, fontSize: 12, color: '#0C447C' }}>
                  📱 ระบบจะแจ้งเตือน LINE ให้สมาชิกโดยอัตโนมัติ
                </div>

                <button onClick={submit} disabled={saving}
                  style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? '⏳ กำลังบันทึก…' : '✅ ยืนยันลงทะเบียน'}
                </button>
              </div>
            )}
          </div>

          {/* Back button (except step 1) */}
          {step !== 'member' && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
              <button onClick={() => {
                if (step === 'plot')    { setStep('member'); setSelMember(null); setPlots([]); }
                if (step === 'timing')  setStep('plot');
                if (step === 'confirm') setStep('timing');
              }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                ← ย้อนกลับ
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
