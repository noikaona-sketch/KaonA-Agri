'use client';

import { useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { UIButton } from '@/shared/components/ui-button';

type MemberRegistrationMVPProps = {
  lineUserId: string;
  onSubmitted: () => Promise<void>;
};

type CaptureMode = 'ocr' | 'manual';

function maskCitizenId(last4: string) {
  return `*********${last4}`;
}

function isValidPhone(phone: string) {
  const sanitized = phone.replace(/[\s()-]/g, '');
  return /^\+?\d{8,15}$/.test(sanitized);
}

function parseLast4FromName(fileName: string) {
  const numbers = fileName.replace(/\D/g, '');
  if (numbers.length < 4) return '';
  return numbers.slice(-4);
}

export function MemberRegistrationMVP({ lineUserId, onSubmitted }: MemberRegistrationMVPProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('ocr');
  const [ocrPhoto, setOcrPhoto] = useState<File | null>(null);
  const [citizenIdLast4, setCitizenIdLast4] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ocrSuggestion = useMemo(() => {
    if (!ocrPhoto) return '';
    return parseLast4FromName(ocrPhoto.name);
  }, [ocrPhoto]);

  const requiresManualFallback = captureMode === 'ocr' && !ocrSuggestion;

  async function submitRegistration() {
    setError(null);

    if (!fullName.trim()) return setError('Please provide your full name.');
    if (phone.trim() && !isValidPhone(phone.trim())) return setError('Phone number format is invalid. Use 8-15 digits (optional + prefix).');
    if (captureMode === 'ocr' && !ocrPhoto) return setError('Please capture your citizen ID photo for OCR before submitting.');

    const normalizedLast4 = (captureMode === 'ocr' ? (ocrSuggestion || citizenIdLast4) : citizenIdLast4).trim();
    if (!/^\d{4}$/.test(normalizedLast4)) return setError('Citizen ID last 4 digits must be exactly 4 numbers.');

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const { error: rpcError } = await supabase.rpc('register_member_mvp', {
      p_line_user_id: lineUserId,
      p_full_name: fullName.trim(),
      p_phone: phone.trim() || null,
      p_citizen_id_masked: maskCitizenId(normalizedLast4),
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setDone(true);
    await onSubmitted();
  }

  return (
    <FormSheet
      title="Member registration"
      footer={
        <UIButton onClick={submitRegistration} loading={submitting} disabled={done} fullWidth>
          {done ? 'Submitted' : 'Submit registration'}
        </UIButton>
      }
    >
      <p>Your account is authenticated, but no member profile exists yet.</p>
      <label>
        Full name
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={submitting || done} />
      </label>
      <label>
        Phone (optional)
        <input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={submitting || done} />
      </label>

      <fieldset disabled={submitting || done}>
        <legend>Citizen ID capture</legend>
        <label>
          <input type="radio" checked={captureMode === 'ocr'} onChange={() => setCaptureMode('ocr')} />
          OCR photo capture (recommended)
        </label>
        <label>
          <input type="radio" checked={captureMode === 'manual'} onChange={() => setCaptureMode('manual')} />
          Manual entry fallback
        </label>
      </fieldset>

      {captureMode === 'ocr' ? (
        <>
          <label>
            Citizen ID photo
            <input type="file" accept="image/*" capture="environment" onChange={(event) => setOcrPhoto(event.target.files?.[0] ?? null)} disabled={submitting || done} />
          </label>
          {ocrPhoto ? <p>Selected file: {ocrPhoto.name}</p> : <p>No OCR photo selected yet.</p>}
          {ocrSuggestion ? <p>OCR suggestion detected: ••••{ocrSuggestion}</p> : <p>OCR could not auto-detect digits. Please confirm manually below.</p>}
        </>
      ) : null}

      <label>
        Citizen ID last 4 digits {requiresManualFallback ? '(required fallback)' : ''}
        <input
          value={captureMode === 'ocr' && ocrSuggestion ? ocrSuggestion : citizenIdLast4}
          onChange={(event) => setCitizenIdLast4(event.target.value.replace(/\D/g, '').slice(0, 4))}
          disabled={submitting || done || (captureMode === 'ocr' && !!ocrSuggestion)}
        />
      </label>

      {error ? <ErrorState title="Registration failed" detail={error} /> : null}
      {done ? <p>Registration submitted. Waiting for approval.</p> : null}
    </FormSheet>
  );
}
