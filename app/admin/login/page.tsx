'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      window.location.href = '/admin';
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mobile-shell">
      <section className="mobile-shell__card">
        <p className="mobile-shell__kicker">Admin web login</p>
        <h1 className="mobile-shell__title">เข้าสู่ระบบแอดมิน</h1>
        <p className="mobile-shell__subtitle">ใช้บัญชีอีเมลของ Supabase Auth สำหรับงานหลังบ้านบนเว็บ</p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {error ? <p style={{ color: '#dc2626', margin: 0 }}>{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: 16 }}>
          ต้องการใช้งานผ่าน LINE LIFF? <Link href="/">กลับหน้าหลัก</Link>
        </p>
      </section>
    </main>
  );
}
