'use client';

import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type MemberRegistrationMVPProps = {
  authUserId: string;
  fallbackLineUserId: string;
  onSubmitted: () => Promise<void>;
};

function maskCitizenId(last4: string) {
  return `*************${last4}`;
}

export function MemberRegistrationMVP({ authUserId, fallbackLineUserId, onSubmitted }: MemberRegistrationMVPProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [citizenIdLast4, setCitizenIdLast4] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submitRegistration() {
    setError(null);

    if (!fullName.trim()) return setError('Please provide your full name.');
    if (!/^\d{4}$/.test(citizenIdLast4)) return setError('Citizen ID requires exactly 4 trailing digits for MVP masking.');

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const { error: rpcError } = await supabase.rpc('register_member_mvp', {
      p_auth_user_id: authUserId,
      p_line_user_id: fallbackLineUserId,
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
    <section className="mobile-shell__card">
      <p className="mobile-shell__kicker">Member registration</p>
      <h1 className="mobile-shell__title">Complete your member profile</h1>
      <p className="mobile-shell__subtitle">Your account is authenticated, but no member profile exists yet.</p>
      <div className="form-sheet__body" style={{ marginTop: 12 }}>
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
      </div>
      {error ? <p className="mobile-shell__subtitle" style={{ color: '#dc2626', marginTop: 10 }}>{error}</p> : null}
      {done ? <p className="mobile-shell__subtitle" style={{ color: '#166534', marginTop: 10 }}>Registration submitted. Waiting for approval.</p> : null}
      <button className="ui-button ui-button--primary" onClick={submitRegistration} disabled={submitting || done} style={{ marginTop: 12 }}>
        {submitting ? 'Submitting...' : 'Submit registration'}
      </button>
    </section>
  );
}
