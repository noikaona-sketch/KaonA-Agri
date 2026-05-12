'use client';

import { useState } from 'react';

import { ensureLiffIdToken } from '@/lib/liff/init-liff';
import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

type TruckFormProps = {
  lineUserId: string;
  onSubmitted: () => void;
};

type Draft = {
  fullName: string;
  phone: string;
  citizenId: string;
  vehicleType: string;
  vehiclePlate: string;
  address: string;
};

function maskCitizenId(v: string) {
  const d = v.replace(/\D/g, '');
  return d.length > 4 ? `${'*'.repeat(d.length - 4)}${d.slice(-4)}` : d;
}

const VEHICLE_TYPES = ['รถบรรทุก 4 ล้อ', 'รถบรรทุก 6 ล้อ', 'รถบรรทุก 10 ล้อ', 'รถพ่วง', 'รถแทรกเตอร์', 'รถอื่นๆ'];

export function RegisterFormTruck({ lineUserId, onSubmitted }: TruckFormProps) {
  const [draft, setDraft] = useState<Draft>({
    fullName: '', phone: '', citizenId: '', vehicleType: '', vehiclePlate: '', address: '',
  });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    draft.fullName.trim() &&
    draft.phone.trim() &&
    draft.citizenId.replace(/\D/g, '').length === 13 &&
    draft.vehicleType &&
    draft.vehiclePlate.trim() &&
    consent;

  function set(field: keyof Draft) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const idToken = await ensureLiffIdToken();
      if (!idToken) { setError('ไม่พบ LINE session กรุณาเปิดใหม่จาก LINE'); return; }

      const res = await fetch('/api/member/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          fullName: draft.fullName.trim(),
          phone: draft.phone.trim(),
          citizenIdMasked: maskCitizenId(draft.citizenId),
          address: draft.address.trim(),
          registrationType: 'self',
          role: 'truck_owner',
          vehicleType: draft.vehicleType,
          vehiclePlate: draft.vehiclePlate.trim(),
        }),
      });

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) { setError(payload.error ?? 'ส่งคำขอไม่สำเร็จ'); return; }

      onSubmitted();
    } catch {
      setError('การเชื่อมต่อขัดข้อง กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mobile-stack">
      <p className="reg-hint">LINE: {lineUserId.slice(0, 8)}…</p>

      {error && <ErrorState title="ส่งคำขอไม่สำเร็จ" detail={error} />}

      <label className="reg-label">
        ชื่อ-นามสกุล <span className="reg-required">*</span>
        <input className="reg-input" value={draft.fullName} onChange={set('fullName')} placeholder="ชื่อตามบัตรประชาชน" disabled={submitting} />
      </label>

      <label className="reg-label">
        เบอร์โทรศัพท์ <span className="reg-required">*</span>
        <input className="reg-input" type="tel" value={draft.phone} onChange={set('phone')} placeholder="0XX-XXX-XXXX" disabled={submitting} />
      </label>

      <label className="reg-label">
        เลขบัตรประชาชน 13 หลัก <span className="reg-required">*</span>
        <input className="reg-input" inputMode="numeric" maxLength={13} value={draft.citizenId} onChange={set('citizenId')} placeholder="1234567890123" disabled={submitting} />
        {draft.citizenId && <span className="reg-hint">แสดงผล: {maskCitizenId(draft.citizenId)}</span>}
      </label>

      <label className="reg-label">
        ประเภทรถ <span className="reg-required">*</span>
        <select className="reg-input" value={draft.vehicleType} onChange={set('vehicleType')} disabled={submitting}>
          <option value="">เลือกประเภทรถ</option>
          {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <label className="reg-label">
        ทะเบียนรถ <span className="reg-required">*</span>
        <input className="reg-input" value={draft.vehiclePlate} onChange={set('vehiclePlate')} placeholder="กข 1234" disabled={submitting} />
      </label>

      <label className="reg-label">
        ที่อยู่
        <input className="reg-input" value={draft.address} onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))} placeholder="จังหวัด / อำเภอ" disabled={submitting} />
      </label>

      <label className="reg-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={submitting} />
        <span>ยินยอมให้ระบบใช้ข้อมูลเพื่อยืนยันตัวตนและพิจารณาสมัครทีมบริการ</span>
      </label>

      <UIButton fullWidth onClick={handleSubmit} disabled={!canSubmit || submitting} loading={submitting}>
        ส่งคำขอสมัครทีมบริการ
      </UIButton>
    </div>
  );
}
