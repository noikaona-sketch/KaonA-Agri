'use client';

import { useRef, useState } from 'react';

import { ensureLiffIdToken } from '@/lib/liff/init-liff';
import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

type LinkPinFormProps = {
  lineUserId: string;
  onSuccess: (role: string) => void;
};

export function RegisterLinkPinForm({ lineUserId, onSuccess }: LinkPinFormProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const pin = digits.join('');
  const isComplete = /^\d{6}$/.test(pin);

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleSubmit() {
    if (!isComplete) return;
    setError(null);
    setSubmitting(true);

    try {
      const idToken = await ensureLiffIdToken();
      if (!idToken) { setError('ไม่พบ LINE session กรุณาเปิดใหม่จาก LINE'); return; }

      const res = await fetch('/api/member/link-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, pin }),
      });

      const payload = (await res.json()) as { ok?: boolean; role?: string; error?: string };

      if (!res.ok || !payload.ok) {
        setError(payload.error ?? 'ไม่สามารถใช้ PIN ได้');
        return;
      }

      onSuccess(payload.role ?? 'farmer');
    } catch {
      setError('การเชื่อมต่อขัดข้อง กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mobile-stack" style={{ alignItems: 'center' }}>
      <div style={{ fontSize: 48 }}>📱</div>

      <div style={{ textAlign: 'center' }}>
        <h2 className="pin-title">ผูก LINE กับบัญชี</h2>
        <p className="pin-subtitle">กรอก PIN ที่ได้รับทาง LINE จากเจ้าหน้าที่</p>
        <p className="reg-hint">LINE: {lineUserId.slice(0, 8)}…</p>
      </div>

      <div className="pin-inputs" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            className={['pin-digit', d ? 'pin-digit--filled' : ''].filter(Boolean).join(' ')}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={submitting}
            aria-label={`หลักที่ ${i + 1}`}
          />
        ))}
      </div>

      <div className="kaona-card" style={{ background: '#fff8e1', borderColor: '#ffe082', width: '100%' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#795548' }}>
          💡 PIN ส่งมาทาง LINE จากเจ้าหน้าที่ที่สร้างบัญชีให้คุณ
        </p>
      </div>

      {error && <ErrorState title="ผูกบัญชีไม่สำเร็จ" detail={error} />}

      <UIButton fullWidth onClick={handleSubmit} disabled={!isComplete || submitting} loading={submitting}>
        ผูกบัญชีและเข้าใช้งาน
      </UIButton>
    </div>
  );
}
