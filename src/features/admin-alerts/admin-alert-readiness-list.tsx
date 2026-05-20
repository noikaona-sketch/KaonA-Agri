'use client';

import { useEffect, useState } from 'react';

type AlertCandidate = {
  key: string;
  title: string;
  readiness: 'ready' | 'watch';
  notSentLabel: string;
  preview: string;
  detail: string;
  count: number;
};

type ApiResponse = {
  generatedAt: string;
  notSent: boolean;
  items: AlertCandidate[];
};

export function AdminAlertReadinessList() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/admin/alert-readiness');
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? 'โหลดข้อมูลไม่สำเร็จ');
      setLoading(false);
      return;
    }
    setData(json as ApiResponse);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Alert Readiness</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280' }}>Read-only preview only · ไม่มีการส่งข้อความจริง</p>
        </div>
        <button onClick={() => void load()} style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 12px', background: '#fff' }}>รีเฟรช</button>
      </div>

      {loading ? <p>กำลังโหลดรายการความพร้อม…</p> : null}
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {data?.items.map((item) => (
          <article key={item.key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <strong>{item.title}</strong>
              <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: item.readiness === 'ready' ? '#dcfce7' : '#fef3c7', color: '#1f2937' }}>
                {item.readiness === 'ready' ? 'READY' : 'WATCH'}
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#1f2937' }}>{item.preview}</p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>{item.detail}</p>
            <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 800, color: '#b91c1c' }}>{item.notSentLabel}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155' }}>Candidate count: {item.count}</p>
          </article>
        ))}
      </div>

      {data?.generatedAt ? <p style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>Generated: {new Date(data.generatedAt).toLocaleString('th-TH')}</p> : null}
    </section>
  );
}
