'use client';

import { useState } from 'react';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { UIButton } from '@/shared/components/ui-button';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'member' | 'plot' | 'review' | 'done';

type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type MemberDraft = {
  full_name: string;
  phone: string;
  citizen_id: string;
  address: string;
  province: string;
};

type PlotDraft = {
  enabled: boolean;
  name: string;
  area_rai: string;
  province: string;
  description: string;
  geo: GeoLocation | null;
};

type DoneResult = {
  member_id: string;
  pin: string;
};

// ─── Style constants ──────────────────────────────────────────────────────────

const S = {
  card: {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid var(--border, #d8e0db)',
    padding: '16px',
    display: 'grid',
    gap: 12,
  } as React.CSSProperties,
  label: {
    display: 'grid',
    gap: 5,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary, #1a1f1c)',
  } as React.CSSProperties,
  input: {
    padding: '10px 12px',
    border: '1.5px solid var(--border, #d8e0db)',
    borderRadius: 10,
    fontSize: 15,
    background: '#fff',
    color: 'var(--text-primary, #1a1f1c)',
    outline: 'none',
    width: '100%',
  } as React.CSSProperties,
  error: {
    background: '#fff5f5',
    border: '1px solid #fca5a5',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#dc2626',
  } as React.CSSProperties,
  stepDot: (active: boolean, done: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    background: done ? 'var(--primary, #2e7d32)' : active ? 'var(--primary, #2e7d32)' : '#e8f0e9',
    color: done || active ? '#fff' : 'var(--text-secondary, #4e5a53)',
    flexShrink: 0,
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'member', label: 'สมาชิก' },
    { key: 'plot',   label: 'แปลง'   },
    { key: 'review', label: 'ตรวจทาน' },
    { key: 'done',   label: 'เสร็จ'  },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 4 }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={S.stepDot(i === idx, i < idx)}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 10, color: i === idx ? 'var(--primary, #2e7d32)' : 'var(--text-secondary, #4e5a53)', fontWeight: i === idx ? 700 : 400 }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < idx ? 'var(--primary, #2e7d32)' : '#e8f0e9', margin: '0 4px', marginBottom: 16 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function GPSButton({
  geo, capturing, onCapture,
}: {
  geo: GeoLocation | null;
  capturing: boolean;
  onCapture: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <UIButton onClick={onCapture} disabled={capturing} fullWidth>
        {capturing ? '⏳ กำลังจับพิกัด…' : geo ? `📍 จับพิกัดใหม่` : '📍 จับพิกัด GPS ณ แปลง'}
      </UIButton>
      {geo && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #4e5a53)', textAlign: 'center' }}>
          ✅ {geo.latitude.toFixed(5)}, {geo.longitude.toFixed(5)} · ±{Math.round(geo.accuracy)} ม.
        </p>
      )}
      {!geo && (
        <p style={{ margin: 0, fontSize: 11, color: '#e65100', textAlign: 'center' }}>
          ⚠️ ยืนอยู่ที่แปลงจริงก่อนกดจับพิกัด
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FieldAssistRegistrationPage() {
  const _member = useCurrentMember();

  const [step, setStep] = useState<Step>('member');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DoneResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [capturingGeo, setCapturingGeo] = useState(false);

  const [mem, setMem] = useState<MemberDraft>({
    full_name: '', phone: '', citizen_id: '', address: '', province: '',
  });

  const [plot, setPlot] = useState<PlotDraft>({
    enabled: true, name: '', area_rai: '', province: '', description: '', geo: null,
  });

  const memberValid = mem.full_name.trim().length > 0;
  const plotValid = !plot.enabled || (
    plot.name.trim().length > 0 && Number(plot.area_rai) > 0 && plot.geo !== null
  );

  function captureGPS() {
    setError(null);
    if (!navigator?.geolocation) {
      setError('อุปกรณ์นี้ไม่รองรับ GPS');
      return;
    }
    setCapturingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlot((p) => ({
          ...p,
          geo: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
        }));
        setCapturingGeo(false);
      },
      (e) => { setError(e.message || 'ไม่สามารถจับพิกัดได้'); setCapturingGeo(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const token = await getBearerToken();
      const payload = {
        full_name: mem.full_name.trim(),
        phone: mem.phone.trim() || undefined,
        citizen_id: mem.citizen_id.trim() || undefined,
        address: mem.address.trim() || undefined,
        province: mem.province || undefined,
        plot: plot.enabled && plot.geo ? {
          name: plot.name.trim(),
          area_rai: Number(plot.area_rai),
          lat: plot.geo.latitude,
          lng: plot.geo.longitude,
          accuracy: plot.geo.accuracy,
          province: plot.province || undefined,
          description: plot.description.trim() || undefined,
        } : undefined,
      };

      const res = await fetch('/api/field/create-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { ok?: boolean; member_id?: string; pin?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'บันทึกไม่สำเร็จ');
        return;
      }
      setResult({ member_id: data.member_id!, pin: data.pin! });
      setStep('done');
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setSubmitting(false);
    }
  }

  function copyPin() {
    if (!result?.pin) return;
    void navigator.clipboard.writeText(result.pin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function reset() {
    setStep('member');
    setMem({ full_name: '', phone: '', citizen_id: '', address: '', province: '' });
    setPlot({ enabled: true, name: '', area_rai: '', province: '', description: '', geo: null });
    setResult(null);
    setError(null);
    setCopied(false);
  }

  return (
    <ProtectedRoute allowedRoles={['staff', 'inspector', 'leader', 'admin']}>
      <MobileAppShell title="ลงทะเบียนแทนสมาชิก" subtitle="สร้างบัญชีและ PIN สำหรับสมาชิกในพื้นที่">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {step !== 'done' && <StepBar step={step} />}

          {error && <div style={S.error}>⚠️ {error}</div>}

          {/* ── Step 1: Member info ── */}
          {step === 'member' && (
            <div style={S.card}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>👤 ข้อมูลสมาชิก</p>

              <label style={S.label}>
                ชื่อ-นามสกุล <span style={{ color: '#e53e3e' }}>*</span>
                <input style={S.input} value={mem.full_name}
                  onChange={(e) => setMem((m) => ({ ...m, full_name: e.target.value }))}
                  placeholder="เช่น สมชาย ใจดี" />
              </label>

              <label style={S.label}>
                เบอร์โทร
                <input style={S.input} type="tel" value={mem.phone}
                  onChange={(e) => setMem((m) => ({ ...m, phone: e.target.value }))}
                  placeholder="08X-XXX-XXXX" />
              </label>

              <label style={S.label}>
                เลขบัตรประชาชน (13 หลัก)
                <input style={S.input} value={mem.citizen_id} inputMode="numeric"
                  onChange={(e) => setMem((m) => ({ ...m, citizen_id: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                  placeholder="X-XXXX-XXXXX-XX-X" />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={S.label}>
                  จังหวัด
                  <input style={S.input} value={mem.province}
                    onChange={(e) => setMem((m) => ({ ...m, province: e.target.value }))}
                    placeholder="เช่น อุบลราชธานี" />
                </label>
                <label style={S.label}>
                  ที่อยู่
                  <input style={S.input} value={mem.address}
                    onChange={(e) => setMem((m) => ({ ...m, address: e.target.value }))}
                    placeholder="บ้านเลขที่/หมู่" />
                </label>
              </div>

              <UIButton fullWidth disabled={!memberValid} onClick={() => { setError(null); setStep('plot'); }}>
                ถัดไป: แปลง →
              </UIButton>
            </div>
          )}

          {/* ── Step 2: Plot ── */}
          {step === 'plot' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>🌽 ข้อมูลแปลง</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={plot.enabled}
                    onChange={(e) => setPlot((p) => ({ ...p, enabled: e.target.checked }))} />
                  เพิ่มแปลงตอนนี้
                </label>
              </div>

              {plot.enabled && (
                <>
                  <label style={S.label}>
                    ชื่อแปลง <span style={{ color: '#e53e3e' }}>*</span>
                    <input style={S.input} value={plot.name}
                      onChange={(e) => setPlot((p) => ({ ...p, name: e.target.value }))}
                      placeholder="เช่น แปลงนาบ้านใหม่" />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={S.label}>
                      พื้นที่ (ไร่) <span style={{ color: '#e53e3e' }}>*</span>
                      <input style={S.input} type="number" inputMode="decimal" min="0.25" step="0.25"
                        value={plot.area_rai}
                        onChange={(e) => setPlot((p) => ({ ...p, area_rai: e.target.value }))}
                        placeholder="0.00" />
                    </label>
                    <label style={S.label}>
                      จังหวัด
                      <input style={S.input} value={plot.province}
                        onChange={(e) => setPlot((p) => ({ ...p, province: e.target.value }))}
                        placeholder="จังหวัด" />
                    </label>
                  </div>

                  <label style={S.label}>
                    รายละเอียด
                    <input style={S.input} value={plot.description}
                      onChange={(e) => setPlot((p) => ({ ...p, description: e.target.value }))}
                      placeholder="จุดสังเกต ทางเข้า เป็นต้น" />
                  </label>

                  <GPSButton geo={plot.geo} capturing={capturingGeo} onCapture={captureGPS} />
                </>
              )}

              {!plot.enabled && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #4e5a53)' }}>
                  ข้ามขั้นตอนนี้ — สมาชิกเพิ่มแปลงเองได้ทีหลังหลัง login
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <UIButton variant="secondary" onClick={() => { setError(null); setStep('member'); }}>
                  ← ย้อนกลับ
                </UIButton>
                <UIButton fullWidth disabled={!plotValid} onClick={() => { setError(null); setStep('review'); }}>
                  ถัดไป: ตรวจทาน →
                </UIButton>
              </div>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 'review' && (
            <div style={S.card}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>🔍 ตรวจทานก่อนบันทึก</p>

              <div style={{ display: 'grid', gap: 8, background: 'var(--bg, #f7f9f7)', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{mem.full_name}</p>
                {mem.phone && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #4e5a53)' }}>📞 {mem.phone}</p>}
                {mem.citizen_id && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #4e5a53)' }}>🪪 ***{mem.citizen_id.slice(-4)}</p>}
                {mem.province && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #4e5a53)' }}>📍 {mem.province}</p>}
              </div>

              {plot.enabled && plot.geo && (
                <div style={{ display: 'grid', gap: 6, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>🌽 {plot.name} · {plot.area_rai} ไร่</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #4e5a53)' }}>
                    📍 {plot.geo.latitude.toFixed(5)}, {plot.geo.longitude.toFixed(5)}
                  </p>
                </div>
              )}

              {!plot.enabled && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #4e5a53)' }}>
                  — ไม่เพิ่มแปลงตอนนี้
                </p>
              )}

              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #4e5a53)', lineHeight: 1.6 }}>
                ระบบจะสร้างบัญชีและ <strong>PIN 6 หลัก</strong> หมดอายุใน 7 วัน<br />
                แจ้ง PIN ให้สมาชิกกรอกใน LINE เพื่อผูกบัญชี
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                <UIButton variant="secondary" onClick={() => { setError(null); setStep('plot'); }}>
                  ← ย้อนกลับ
                </UIButton>
                <UIButton fullWidth loading={submitting} onClick={handleSubmit}>
                  {submitting ? 'กำลังบันทึก…' : '✅ บันทึกและสร้าง PIN'}
                </UIButton>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ ...S.card, textAlign: 'center', background: '#f0fdf4', borderColor: '#86efac' }}>
                <p style={{ margin: 0, fontSize: 32 }}>🎉</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--primary, #2e7d32)' }}>
                  สร้างบัญชีสำเร็จ!
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #4e5a53)' }}>
                  {mem.full_name}
                </p>
              </div>

              <div style={{ ...S.card, textAlign: 'center', gap: 16 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>🔑 PIN สำหรับสมาชิก</p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  {result.pin.split('').map((d, i) => (
                    <div key={i} style={{
                      width: 44, height: 52, background: '#eff6ff', border: '2px solid #93c5fd',
                      borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, fontWeight: 800, color: '#1d4ed8', letterSpacing: 0,
                    }}>
                      {d}
                    </div>
                  ))}
                </div>

                <UIButton fullWidth variant="secondary" onClick={copyPin}>
                  {copied ? '✅ คัดลอกแล้ว' : '📋 คัดลอก PIN'}
                </UIButton>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', textAlign: 'left' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>วิธีใช้ PIN</p>
                  <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary, #4e5a53)' }}>
                    <li>สมาชิกเปิด LINE Mini App KaonA</li>
                    <li>เลือก &quot;มี PIN จากเจ้าหน้าที่&quot;</li>
                    <li>กรอก PIN 6 หลักนี้</li>
                    <li>ระบบผูก LINE และอนุมัติทันที</li>
                  </ol>
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: '#e65100' }}>
                    ⏱ PIN หมดอายุใน 7 วัน · ใช้ได้ครั้งเดียว
                  </p>
                </div>
              </div>

              <UIButton fullWidth onClick={reset}>
                + ลงทะเบียนสมาชิกต่อไป
              </UIButton>
            </div>
          )}

        </div>
      </MobileAppShell>
    </ProtectedRoute>
  );
}
