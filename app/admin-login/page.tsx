'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin-auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) { setError(payload.error ?? 'เข้าสู่ระบบไม่สำเร็จ'); return; }

      const next = new URL(window.location.href).searchParams.get('next');
      window.location.href = (next && next.startsWith('/admin')) ? next : '/admin';
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f0', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', padding: '32px 28px' }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#1b5e20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🌾</div>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1b5e20' }}>KaonA Agri</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>ระบบหลังบ้าน</p>
          </div>
        </div>

        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>เข้าสู่ระบบ</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>สำหรับเจ้าหน้าที่และแอดมิน</p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          <label className="reg-label">อีเมล
            <input className="reg-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@kaona.app" autoComplete="email" disabled={loading} />
          </label>

          <label className="reg-label">รหัสผ่าน
            <input className="reg-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" disabled={loading} />
          </label>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: '#dc2626' }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: loading ? '#a5d6a7' : '#1b5e20', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
          ยังไม่มีบัญชี?{' '}
          <a href="/admin/register" style={{ color: '#2e7d32', fontWeight: 600 }}>สมัครบัญชีเจ้าหน้าที่</a>
        </p>
      </div>
    </main>
  );
}
