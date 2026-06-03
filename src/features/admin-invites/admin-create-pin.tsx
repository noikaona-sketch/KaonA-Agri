'use client';

import { useState } from 'react';

import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

type Mode = 'new' | 'existing';

const ROLES = [
  { value: 'farmer',      label: 'สมาชิกเกษตรกร 🌾' },
  { value: 'truck_owner', label: 'ทีมบริการ 🚛' },
  { value: 'inspector',   label: 'ผู้ตรวจสอบ 🔍' },
  { value: 'staff',       label: 'พนักงาน 👷' },
  { value: 'leader',      label: 'หัวหน้ากลุ่ม 👥' },
  { value: 'admin',       label: 'แอดมิน ⚙️' },
];

type PinResult = { pin: string; memberId: string };

export function AdminCreatePin() {
  const [mode, setMode] = useState<Mode>('new');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [memberId, setMemberId] = useState('');
  const [role, setRole] = useState('farmer');
  const [hours, setHours] = useState(72);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PinResult | null>(null);

  async function handleCreate() {
    setError(null);
    setSubmitting(true);
    try {
      const body = mode === 'new'
        ? { fullName, phone, role, hours }
        : { memberId, role, hours };

      const res = await fetch('/api/admin/create-pin', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { ok?: boolean; pin?: string; memberId?: string; error?: string };
      if (!res.ok || !payload.pin) { setError(payload.error ?? 'สร้าง PIN ไม่สำเร็จ'); return; }
      setResult({ pin: payload.pin, memberId: payload.memberId ?? memberId });
    } catch { setError('การเชื่อมต่อขัดข้อง'); } finally { setSubmitting(false); }
  }

  function reset() { setResult(null); setFullName(''); setPhone(''); setMemberId(''); }

  if (result) {
    return (
      <div className="mobile-stack" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🔑</div>
        <h2 style={{ margin: '8px 0 4px', color: 'var(--primary)' }}>PIN สร้างแล้ว!</h2>
        <div className="pin-inputs" style={{ justifyContent: 'center', margin: '12px 0' }}>
          {result.pin.split('').map((d, i) => (
            <div key={i} className="pin-digit pin-digit--filled" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</div>
          ))}
        </div>
        <div className="kaona-card" style={{ background: '#fff8e1', borderColor: '#ffe082', textAlign: 'left' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>ส่ง PIN ทาง LINE ให้สมาชิก</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            PIN หมดอายุใน {hours} ชั่วโมง และใช้ได้ครั้งเดียว
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Member ID: {result.memberId.slice(0, 8)}…
          </p>
        </div>
        <UIButton fullWidth onClick={reset}>สร้าง PIN ใหม่</UIButton>
      </div>
    );
  }

  const canCreate = mode === 'new' ? fullName.trim() && role : memberId.trim() && role;

  return (
    <div className="mobile-stack">
      <div className="reg-tabs" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {(['new', 'existing'] as Mode[]).map((m) => (
          <button key={m} className={['reg-tab', mode === m ? 'reg-tab--active' : ''].join(' ')} onClick={() => setMode(m)}>
            <span className="reg-tab__icon">{m === 'new' ? '➕' : '🔍'}</span>
            <span className="reg-tab__label">{m === 'new' ? 'สร้างสมาชิกใหม่' : 'สมาชิกที่มีอยู่'}</span>
          </button>
        ))}
      </div>

      {error && <ErrorState title="สร้าง PIN ไม่สำเร็จ" detail={error} />}

      {mode === 'new' ? (
        <>
          <label className="reg-label">ชื่อสมาชิก <span className="reg-required">*</span>
            <input className="reg-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อ-นามสกุล" disabled={submitting} />
          </label>
          <label className="reg-label">เบอร์โทร
            <input className="reg-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0XX-XXX-XXXX" disabled={submitting} />
          </label>
        </>
      ) : (
        <label className="reg-label">Member ID <span className="reg-required">*</span>
          <input className="reg-input" value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="UUID ของสมาชิก" disabled={submitting} />
        </label>
      )}

      <label className="reg-label">บทบาท <span className="reg-required">*</span>
        <select className="reg-input" value={role} onChange={(e) => setRole(e.target.value)} disabled={submitting}>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>

      <label className="reg-label">อายุ PIN (ชั่วโมง)
        <select className="reg-input" value={hours} onChange={(e) => setHours(Number(e.target.value))} disabled={submitting}>
          <option value={24}>24 ชั่วโมง</option>
          <option value={72}>72 ชั่วโมง (3 วัน)</option>
          <option value={168}>168 ชั่วโมง (7 วัน)</option>
        </select>
      </label>

      <UIButton fullWidth onClick={handleCreate} disabled={!canCreate || submitting} loading={submitting}>
        สร้าง PIN
      </UIButton>
    </div>
  );
}
