'use client';

import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { UIButton } from '@/shared/components/ui-button';

type MemberRegistrationMVPProps = {
  lineUserId: string;
  onSubmitted: () => Promise<void>;
};

function maskCitizenId(last4: string) {
  return `*********${last4}`;
}

function isValidPhone(phone: string) {
  const sanitized = phone.replace(/[\s()-]/g, '');
  return /^\+?\d{8,15}$/.test(sanitized);
}

export function MemberRegistrationMVP({ lineUserId, onSubmitted }: MemberRegistrationMVPProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [citizenIdLast4, setCitizenIdLast4] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submitRegistration() {
    setError(null);

    if (!fullName.trim()) return setError('Please provide your full name.');
    if (!/^\d{4}$/.test(citizenIdLast4)) return setError('Citizen ID last 4 digits must be exactly 4 numbers.');
    if (phone.trim() && !isValidPhone(phone.trim())) return setError('Phone number format is invalid. Use 8-15 digits (optional + prefix).');

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const { error: rpcError } = await supabase.rpc('register_member_mvp', {
      p_line_user_id: lineUserId,
      p_full_name: fullName.trim(),
      p_phone: phone.trim() || null,
      p_citizen_id_masked: maskCitizenId(citizenIdLast4),
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
      <label>
        Citizen ID last 4 digits
        <input value={citizenIdLast4} onChange={(event) => setCitizenIdLast4(event.target.value.replace(/\D/g, '').slice(0, 4))} disabled={submitting || done} />
      </label>
      {error ? <ErrorState title="Registration failed" detail={error} /> : null}
      {done ? <p>Registration submitted. Waiting for approval.</p> : null}
    </FormSheet>
  );
}
