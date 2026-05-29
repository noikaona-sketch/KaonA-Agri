'use client';

import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Member  = { id: string; full_name: string; phone: string | null };
type Plot    = { id: string; name: string; province: string | null; area_rai: number | null };
type Cycle   = { id: string; crop_name: string; season_year: number };
type Timing  = 'before_planting' | 'after_planting';

const TIMING_CFG: Record<Timing, { icon: string; label: string; sub: string }> = {
  before_planting: { icon: '🌱', label: 'ก่อนลงแปลง',     sub: 'ยังไม่ได้ปลูก' },
  after_planting:  { icon: '🌿', label: 'หลังลงแปลงแล้ว', sub: 'ปลูกแล้ว' },
};

const STEPS = ['สมาชิก', 'แปลง', 'รายละเอียด', 'ยืนยัน'] as const;
type Step = 'member' | 'plot' | 'detail' | 'confirm';
const STEP_KEYS: Step[] = ['member', 'plot', 'detail', 'confirm'];

type Props = { onClose: () => void; onSuccess: () => void };

// ─────────────────────────────────────────────────────────────────────────────
export function AdminNoBurnRegisterModal({ onClose, onSuccess }: Props) {
  const fileId    = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Admin identity ──────────────────────────────────────────────────────────
  const [adminName, setAdminName] = useState('เจ้าหน้าที่');
  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    void sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await sb.from('admin_users')
        .select('full_name').eq('auth_user_id', user.id).maybeSingle();
      if (data?.full_name) setAdminName(data.full_name);
      else if (user.email)  setAdminName(user.email.split('@')[0]);
    });
  }, []);

  // ── Step ────────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('member');

  // ── Member search ───────────────────────────────────────────────────────────
  const [searchQ,   setSearchQ]   = useState('');
  const [members,   setMembers]   = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selMember, setSelMember] = useState<Member | null>(null);

  // ── Plot / Cycle ────────────────────────────────────────────────────────────
  const [plots,    setPlots]    = useState<Plot[]>([]);
  const [cycles,   setCycles]   = useState<Cycle[]>([]);
  const [selPlot,  setSelPlot]  = useState<Plot | null>(null);

  // ── Detail form ─────────────────────────────────────────────────────────────
  const [timing,      setTiming]      = useState<Timing>('after_planting');
  const [selCycle,    setSelCycle]    = useState('');
  const [note,        setNote]        = useState('');
  const [photoFiles,  setPhotoFiles]  = useState<File[]>([]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Search members with debounce ────────────────────────────────────────────
  useEffect(() => {
    if (searchQ.length < 2) { setMembers([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const sb = createSupabaseBrowserClient();
      const { data } = await sb.from('members')
        .select('id,full_name,phone').eq('status', 'approved')
        .or(`full_name.ilike.%${searchQ}%,phone.ilike.%${searchQ}%`)
        .limit(8);
      setMembers((data as Member[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function selectMember(m: Member) {
    setSelMember(m); setSearchQ(''); setMembers([]);
    const sb = createSupabaseBrowserClient();
    const [{ data: p }, { data: c }] = await Promise.all([
      sb.from('plots').select('id,name,province,area_rai').eq('member_id', m.id).is('deleted_at', null),
      sb.from('planting_cycles').select('id,crop_name,season_year').eq('member_id', m.id).not('status','in','("harvested","cancelled")'),
    ]);
    setPlots((p as Plot[]) ?? []);
    setCycles((c as Cycle[]) ?? []);
    setStep('plot');
  }

  function onPickPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files].slice(0, 4));
    e.target.value = '';
  }

  async function submit() {
    if (!selMember || !selPlot) return;
    setSaving(true); setError(null);

    // Upload photos first (best-effort)
    const uploadedPaths: string[] = [];
    if (photoFiles.length > 0) {
      const sb = createSupabaseBrowserClient();
      for (const file of photoFiles) {
        const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `admin-register/${selMember.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await sb.storage.from('member-photos').upload(path, file, { upsert: true });
        if (!upErr) uploadedPaths.push(path);
      }
    }

    const res = await fetch('/api/admin/no-burn/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:         selMember.id,
        plot_id:           selPlot.id,
        timing,
        planting_cycle_id: selCycle || null,
        note:              note.trim() || null,
        registered_by:     adminName,
        photo_paths:       uploadedPaths,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok || json.error) { setError(json.error ?? 'บันทึกไม่สำเร็จ'); return; }
    onSuccess();
  }

  // ── Back ────────────────────────────────────────────────────────────────────
  function goBack() {
    if (step === 'plot')    { setStep('member'); setSelMember(null); setPlots([]); setCycles([]); }
    if (step === 'detail')  setStep('plot');
    if (step === 'confirm') setStep('detail');
  }

  const stepIndex = STEP_KEYS.indexOf(step);
  const cropLabel = cycles.find(c => c.id === selCycle);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />

      <div style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{
          background: '#fff', borderRadius: 24, width: '100%', maxWidth: 500,
          maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}>

          {/* ── Header ── */}
          <div style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', padding: '20px 20px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#fff' }}>🌿 ลงทะเบียนงดเผา</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  บันทึกโดย <strong style={{ color: '#a5d6a7' }}>{adminName}</strong>
                </p>
              </div>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10,
                width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            {/* Step breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 14 }}>
              {STEPS.map((label, i) => {
                const done   = stepIndex > i;
                const active = stepIndex === i;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: done ? '#a5d6a7' : active ? '#fff' : 'rgba(255,255,255,0.2)',
                        color:      done ? '#1b5e20' : active ? '#2e7d32' : 'rgba(255,255,255,0.5)',
                      }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: active ? 800 : 400, color: active ? '#fff' : done ? '#a5d6a7' : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

            {/* Error toast */}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FAEEDA', border: '1px solid #854F0B', color: '#633806', fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>⚠️</span><span style={{ flex: 1 }}>{error}</span>
                <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
              </div>
            )}

            {/* ════════════════════ STEP 1: MEMBER ════════════════════ */}
            {step === 'member' && (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>ค้นหาสมาชิก</p>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <input ref={searchRef} autoFocus type="text" value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="พิมพ์ชื่อหรือเบอร์โทร…"
                    style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 12, border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    onFocus={(e) => { e.target.style.borderColor = '#2e7d32'; }}
                    onBlur={(e)  => { e.target.style.borderColor = '#d1d5db'; }}
                  />
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
                  {searching && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af' }}>ค้นหา…</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {members.map((m) => (
                    <button key={m.id} onClick={() => selectMember(m)} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fafafa',
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all .12s',
                    }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e7d32'; (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = '#fafafa'; }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#e8f5e9,#c8e6c9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👤</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111' }}>{m.full_name}</p>
                        {m.phone && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{m.phone}</p>}
                      </div>
                      <span style={{ color: '#d1d5db', fontSize: 18 }}>›</span>
                    </button>
                  ))}
                </div>

                {searchQ.length >= 2 && !searching && members.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>ไม่พบสมาชิก</p>
                )}
                {searchQ.length < 2 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '16px 0' }}>พิมพ์อย่างน้อย 2 ตัวอักษร</p>
                )}
              </div>
            )}

            {/* ════════════════════ STEP 2: PLOT ════════════════════ */}
            {step === 'plot' && selMember && (
              <div>
                {/* Selected member chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16 }}>
                  <span style={{ fontSize: 18 }}>👤</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1b5e20' }}>{selMember.full_name}</p>
                    {selMember.phone && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{selMember.phone}</p>}
                  </div>
                </div>

                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>เลือกแปลง</p>

                {plots.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', background: '#f9fafb', borderRadius: 16, border: '1.5px dashed #e0e0e0' }}>
                    <p style={{ margin: 0, fontSize: 36 }}>🗺️</p>
                    <p style={{ margin: '10px 0 0', fontSize: 13, color: '#6b7280', fontWeight: 600 }}>สมาชิกยังไม่มีแปลงที่ลงทะเบียน</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>ต้องลงทะเบียนแปลงก่อน</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plots.map((p) => (
                      <button key={p.id} onClick={() => { setSelPlot(p); setStep('detail'); }} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                        borderRadius: 14, border: '1.5px solid #e5e7eb', background: '#fff',
                        cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all .12s',
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e7d32'; (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
                      >
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#e8f5e9,#c8e6c9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🌾</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#111' }}>{p.name}</p>
                          <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                            {p.province && <span style={{ fontSize: 11, color: '#6b7280' }}>📍 {p.province}</span>}
                            {p.area_rai  && <span style={{ fontSize: 11, color: '#6b7280' }}>📐 {p.area_rai} ไร่</span>}
                          </div>
                        </div>
                        <span style={{ color: '#d1d5db', fontSize: 18 }}>›</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════ STEP 3: DETAIL ════════════════════ */}
            {step === 'detail' && selMember && selPlot && (
              <div>
                {/* Context chip */}
                <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#2e7d32', fontWeight: 700 }}>
                    👤 {selMember.full_name} · 🌾 {selPlot.name}{selPlot.province ? ` · ${selPlot.province}` : ''}
                  </p>
                </div>

                {/* Timing */}
                <div style={{ marginBottom: 18 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                    จะงดเผาตอนไหน? <span style={{ color: '#dc2626' }}>*</span>
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['before_planting', 'after_planting'] as Timing[]).map((t) => {
                      const cfg = TIMING_CFG[t]; const sel = timing === t;
                      return (
                        <button key={t} onClick={() => { setTiming(t); if (t === 'before_planting') setSelCycle(''); }}
                          style={{ flex: 1, padding: '14px 12px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', border: `2px solid ${sel ? '#2e7d32' : '#e5e7eb'}`, background: sel ? '#f0fdf4' : '#fff', transition: 'all .15s' }}>
                          <p style={{ margin: '0 0 5px', fontSize: 24 }}>{cfg.icon}</p>
                          <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 13, color: sel ? '#2e7d32' : '#111' }}>{cfg.label}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{cfg.sub}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Planting cycle */}
                {timing === 'after_planting' && cycles.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                      รอบเพาะปลูก <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ไม่บังคับ)</span>
                    </p>
                    <div style={{ position: 'relative' }}>
                      <select value={selCycle} onChange={(e) => setSelCycle(e.target.value)}
                        style={{ width: '100%', padding: '11px 36px 11px 14px', borderRadius: 12, border: '1.5px solid #d1d5db', appearance: 'none', WebkitAppearance: 'none', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
                        <option value="">ไม่ระบุ</option>
                        {cycles.map((c) => <option key={c.id} value={c.id}>{c.crop_name} {c.season_year}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280', fontSize: 12 }}>▾</span>
                    </div>
                  </div>
                )}

                {/* Note */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    หมายเหตุ <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ไม่บังคับ)</span>
                  </p>
                  <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="เช่น สมาชิกแจ้งด้วยตนเอง ณ จุดรับซื้อ…"
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #d1d5db', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                    onFocus={(e) => { e.target.style.borderColor = '#2e7d32'; }}
                    onBlur={(e)  => { e.target.style.borderColor = '#d1d5db'; }}
                  />
                </div>

                {/* Photos */}
                <div style={{ marginBottom: 18 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    แนบรูปหลักฐาน <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ไม่บังคับ · สูงสุด 4 รูป)</span>
                  </p>
                  {photoFiles.length < 4 && (
                    <label htmlFor={fileId} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '11px', borderRadius: 12, border: '1.5px dashed #d1d5db',
                      background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 18 }}>📷</span> เลือกรูป
                      <input id={fileId} type="file" accept="image/*" multiple onChange={onPickPhotos} style={{ display: 'none' }} />
                    </label>
                  )}
                  {photoFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>📷</span>
                      <span style={{ flex: 1, fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <button onClick={() => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
                    </div>
                  ))}
                </div>

                <button onClick={() => setStep('confirm')}
                  style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                  ถัดไป →
                </button>
              </div>
            )}

            {/* ════════════════════ STEP 4: CONFIRM ════════════════════ */}
            {step === 'confirm' && selMember && selPlot && (
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#374151' }}>ตรวจสอบข้อมูลก่อนบันทึก</p>

                <div style={{ background: '#f9fafb', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 14 }}>
                  {([
                    ['👤 สมาชิก',   selMember.full_name + (selMember.phone ? ` · ${selMember.phone}` : '')],
                    ['🌾 แปลง',     selPlot.name + (selPlot.province ? ` · ${selPlot.province}` : '')],
                    ['⏱ จังหวะ',   TIMING_CFG[timing].icon + ' ' + TIMING_CFG[timing].label],
                    ...(cropLabel ? [['🌿 รอบปลูก', `${cropLabel.crop_name} ${cropLabel.season_year}`] as [string,string]] : []),
                    ...(note.trim() ? [['📝 หมายเหตุ', note.trim()] as [string,string]] : []),
                    ...(photoFiles.length > 0 ? [['📷 รูปหลักฐาน', `${photoFiles.length} รูป`] as [string,string]] : []),
                    ['🧑‍💼 บันทึกโดย', adminName],
                  ] as [string, string][]).map(([label, value], i, arr) => (
                    <div key={label} style={{ padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 90, flexShrink: 0, paddingTop: 1 }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: label === '🧑‍💼 บันทึกโดย' ? 700 : 600, color: label === '🧑‍💼 บันทึกโดย' ? '#2e7d32' : '#111', lineHeight: 1.5 }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#E6F1FB', border: '1px solid #185FA5', marginBottom: 16, fontSize: 12, color: '#0C447C', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>📱</span>
                  <span>ระบบจะแจ้งเตือน LINE ให้สมาชิกอัตโนมัติ</span>
                </div>

                <button onClick={submit} disabled={saving}
                  style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'default' : 'pointer', transition: 'all .2s' }}>
                  {saving ? '⏳ กำลังบันทึก…' : '✅ ยืนยันลงทะเบียน'}
                </button>
              </div>
            )}
          </div>

          {/* ── Footer: back button ── */}
          {step !== 'member' && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
              <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                ← ย้อนกลับ
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
