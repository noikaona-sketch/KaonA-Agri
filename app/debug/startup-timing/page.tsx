'use client';

import { useEffect, useState } from 'react';

type Step = {
  name:     string;
  start:    number;
  end:      number | null;
  duration: number | null;
  status:   'pending' | 'done' | 'error';
  detail?:  string;
};

function ms(n: number | null) {
  if (n === null) return '…';
  return `${n.toFixed(0)} ms`;
}

function color(s: Step) {
  if (s.status === 'pending') return '#9ca3af';
  if (s.status === 'error')   return '#dc2626';
  const d = s.duration ?? 0;
  if (d < 300)  return '#16a34a';
  if (d < 800)  return '#d97706';
  return '#dc2626';
}

function bar(d: number | null, max = 4000) {
  if (d === null) return 0;
  return Math.min(100, (d / max) * 100);
}

export default function StartupTimingPage() {
  const [steps, setSteps]   = useState<Step[]>([]);
  const [total, setTotal]   = useState<number | null>(null);
  const [pageStart]         = useState(() => performance.now());

  function addStep(name: string): (detail?: string) => void {
    const start = performance.now() - pageStart;
    setSteps((prev) => [...prev, { name, start, end: null, duration: null, status: 'pending' }]);
    return (detail?: string, error = false) => {
      const end = performance.now() - pageStart;
      setSteps((prev) => prev.map((s) =>
        s.name === name && s.status === 'pending'
          ? { ...s, end, duration: end - start, status: error ? 'error' : 'done', detail }
          : s
      ));
    };
  }

  useEffect(() => {
    void (async () => {
      // ── 1. Page script start ──────────────────────────────────────
      const finishPage = addStep('1. Page script loaded');
      finishPage(`pageStart = 0ms (baseline)`);

      // ── 2. LIFF SDK available ─────────────────────────────────────
      const finishLiff = addStep('2. LIFF SDK check');
      try {
        const liff = (window as unknown as { liff?: { isInClient?: () => boolean; ready?: Promise<void> } }).liff;
        if (liff) {
          finishLiff(`isInClient = ${liff.isInClient?.()}`);
        } else {
          finishLiff('liff object not found (not in LINE)', true);
        }
      } catch (e) {
        finishLiff(String(e), true);
      }

      // ── 3. LIFF ready ─────────────────────────────────────────────
      const finishLiffReady = addStep('3. LIFF ready (liff.ready)');
      try {
        const liff = (window as unknown as { liff?: { ready?: Promise<void>; getIdToken?: () => string | null } }).liff;
        if (liff?.ready) {
          await liff.ready;
          finishLiffReady('resolved');
        } else {
          finishLiffReady('liff.ready not available', true);
        }
      } catch (e) {
        finishLiffReady(String(e), true);
      }

      // ── 4. getIdToken ─────────────────────────────────────────────
      const finishToken = addStep('4. liff.getIdToken()');
      let idToken: string | null = null;
      try {
        const liff = (window as unknown as { liff?: { getIdToken?: () => string | null } }).liff;
        idToken = liff?.getIdToken?.() ?? null;
        finishToken(idToken ? `token present (${idToken.length} chars)` : 'null — not in LIFF', !idToken);
      } catch (e) {
        finishToken(String(e), true);
      }

      // ── 5. POST /api/auth/line ────────────────────────────────────
      const finishAuth = addStep('5. POST /api/auth/line');
      let sessionToken: string | null = null;
      try {
        const t0 = performance.now();
        const res = await fetch('/api/auth/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: idToken ?? 'timing-test-no-token' }),
        });
        const latency = (performance.now() - t0).toFixed(0);
        const payload = await res.json() as { session?: { access_token: string }; error?: string };
        sessionToken = payload.session?.access_token ?? null;
        finishAuth(`HTTP ${res.status} — ${latency}ms — session: ${sessionToken ? 'yes' : 'no'}`, !res.ok);
      } catch (e) {
        finishAuth(String(e), true);
      }

      // ── 6. Supabase getSession ────────────────────────────────────
      const finishSession = addStep('6. supabase.auth.getSession()');
      try {
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
        const sb = createSupabaseBrowserClient();
        const { data: { session } } = await sb.auth.getSession();
        finishSession(session ? `has session, uid=${session.user.id.slice(0,8)}…` : 'no session');
      } catch (e) {
        finishSession(String(e), true);
      }

      // ── 7. /api/member/quota ──────────────────────────────────────
      const finishQuota = addStep('7. GET /api/member/quota');
      try {
        const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
        const sb = createSupabaseBrowserClient();
        const { data: { session } } = await sb.auth.getSession();
        const headers: Record<string,string> = {};
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        const res = await fetch('/api/member/quota', { headers });
        const d = await res.json() as { quota_ton?: number | null };
        finishQuota(`HTTP ${res.status} — quota_ton=${d.quota_ton ?? 'null'}`);
      } catch (e) {
        finishQuota(String(e), true);
      }

      // ── 8. Total ──────────────────────────────────────────────────
      const totalTime = performance.now() - pageStart;
      setTotal(totalTime);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxDur = Math.max(...steps.map((s) => s.duration ?? 0), 1000);

  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', padding: '16px', maxWidth: 500, margin: '0 auto' }}>
      <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>⏱ Startup Timing</p>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280' }}>
        เปิดใน LINE Mini App เพื่อผลที่ถูกต้อง
      </p>

      {steps.map((s) => (
        <div key={s.name} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ fontWeight: 500, color: '#111' }}>{s.name}</span>
            <span style={{ fontWeight: 700, color: color(s) }}>{ms(s.duration)}</span>
          </div>
          {/* bar */}
          <div style={{ height: 6, background: '#f3f4f6', borderRadius: 4, margin: '4px 0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${bar(s.duration, maxDur)}%`, background: color(s), borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          {s.detail && (
            <p style={{ margin: 0, fontSize: 11, color: s.status === 'error' ? '#dc2626' : '#6b7280' }}>
              {s.detail}
            </p>
          )}
        </div>
      ))}

      {total !== null && (
        <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, background: total > 5000 ? '#fef2f2' : total > 3000 ? '#fffbeb' : '#f0fdf4', border: `1.5px solid ${total > 5000 ? '#fca5a5' : total > 3000 ? '#fcd34d' : '#86efac'}` }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: total > 5000 ? '#dc2626' : total > 3000 ? '#d97706' : '#16a34a' }}>
            รวม: {ms(total)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
            {total > 5000 ? '🔴 ช้ามาก — ดู step ที่ใช้เวลานานสุด' :
             total > 3000 ? '🟡 ปานกลาง — มีพื้นที่ปรับปรุง' :
             '🟢 ดี'}
          </p>
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        This page is for debugging only. Do not expose in production.
      </p>
    </div>
  );
}
