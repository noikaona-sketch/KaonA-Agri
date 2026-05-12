'use client';

import { useRef, useState } from 'react';

import { ensureLiffIdToken } from '@/lib/liff/init-liff';
import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

type PinFormProps = {
  lineUserId: string;
  onSuccess: (role: string) => void;
};

type Step = 'enter_pin' | 'submitting' | 'error';

export function RegisterPinForm({ lineUserId, onSuccess }: PinFormProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [step, setStep] = useState<Step>('enter_pin');
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const pin = digits.join('');
  const isComplete = pin.length === 6 && /^\d{6}$/.test(pin);

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
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
    setStep('submitting');

    try {
      const idToken = await ensureLiffIdToken();
      if (!idToken) {
        setError('ไม่พบ LINE session กรุณาเปิดใหม่จาก LINE');
        setStep('error');
        return;
      }

      const res = await fetch('/api/member/redeem-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, pin }),
      });

      const payload = (await res.json()) as { ok?: boolean; role?: string; error?: string };

      if (!res.ok || !payload.ok) {
        setError(payload.error ?? 'ไม่สามารถใช้ PIN ได้');
        setStep('error');
        return;
      }

      onSuccess(payload.role ?? 'staff');
    } catch {
      setError('การเชื่อมต่อขัดข้อง กรุณาลองใหม่');
      setStep('error');
    }
  }

  function reset() {
    setDigits(Array(6).fill(''));
    setStep('enter_pin');
    setError(null);
    inputRefs.current[0]?.focus();
  }

  const isSubmitting = step === 'submitting';

  return (
    <div className="mobile-stack" style={{ alignItems: 'center' }}>
      <div className="pin-icon">🔑</div>

      <div style={{ textAlign: 'center' }}>
        <h2 className="pin-title">กรอก PIN 6 หลัก</h2>
        <p className="pin-subtitle">รับ PIN จากเจ้าหน้าที่ภาคสนาม</p>
        <p className="reg-hint">LINE: {lineUserId.slice(0, 8)}…</p>
      </div>

      {/* PIN Input */}
      <div className="pin-inputs" onPaste={handlePaste} aria-label="กรอก PIN 6 หลัก">
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
            disabled={isSubmitting}
            aria-label={`หลักที่ ${i + 1}`}
          />
        ))}
      </div>

      {error && <ErrorState title="ไม่สามารถใช้ PIN ได้" detail={error} />}

      <UIButton
        fullWidth
        onClick={handleSubmit}
        disabled={!isComplete || isSubmitting}
        loading={isSubmitting}
      >
        ยืนยัน PIN
      </UIButton>

      {step === 'error' && (
        <UIButton variant="ghost" fullWidth onClick={reset}>
          ลองใหม่อีกครั้ง
        </UIButton>
      )}
    </div>
  );
}
