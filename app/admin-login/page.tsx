'use client';

import { useState } from 'react';
import { isAdminWebPath } from '@/shared/auth/admin-web-path';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? 'Login failed');
        return;
      }

      const currentUrl = new URL(window.location.href);
      const next = currentUrl.searchParams.get('next');
      const redirectTarget = next && isAdminWebPath(next) && next !== '/admin-login' ? next : '/admin-prototype';
      window.location.href = redirectTarget;
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mobile-shell">
      <section className="mobile-shell__card">
        <p className="mobile-shell__kicker">Backoffice QA</p>
        <h1 className="mobile-shell__title">Admin Web Login</h1>
        <p className="mobile-shell__subtitle">เข้าสู่ระบบสำหรับแอดมิน/เจ้าหน้าที่บนเว็บเบราว์เซอร์</p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <label>
            Email
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p style={{ margin: 0, color: '#dc2626' }}>{error}</p> : null}
          <button disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
