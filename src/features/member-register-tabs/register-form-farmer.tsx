'use client';

import { useState } from 'react';

import { ensureLiffIdToken } from '@/lib/liff/init-liff';
import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

type FarmerFormProps = {
  lineUserId: string;
  onSubmitted: () => void;
};

type Draft = {
  fullName: string;
  phone: string;
  citizenId: string;
  address: string;
};

function maskCitizenId(v: string) {
  const d = v.replace(/\D/g, '');
  return d.length > 4 ? `${'*'.repeat(d.length - 4)}${d.slice(-4)}` : d;
}

export function RegisterFormFarmer({ lineUserId, onSubmitted }: FarmerFormProps) {
  const [draft, setDraft] = useState<Draft>({ fullName: '', phone: '', citizenId: '', address: '' });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = draft.fullName.trim() && draft.phone.trim() && draft.citizenId.replace(/\D/g,'').length === 13 && consent;

  function set(field: keyof Draft) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
        ที่อยู่ตามบัตรประชาชน
        <textarea className="reg-input reg-textarea" value={draft.address} onChange={set('address')} rows={3} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด" disabled={submitting} />
      </label>

      <label className="reg-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={submitting} />
        <span>ยินยอมให้ระบบใช้ข้อมูลเพื่อยืนยันตัวตนและพิจารณาสมัครสมาชิก</span>
      </label>

      <UIButton fullWidth onClick={handleSubmit} disabled={!canSubmit || submitting} loading={submitting}>
        ส่งคำขอสมัครสมาชิก
      </UIButton>
    </div>
  );
}
