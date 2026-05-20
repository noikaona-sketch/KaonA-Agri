'use client';
import { useEffect, useState } from 'react';

export function AdminSurveyResponses() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/surveys/responses');
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? 'โหลดไม่สำเร็จ');
        return;
      }
      setRows(j.rows ?? []);
    })();
  }, []);

  return <div className='kaona-card'><h3>คำตอบแบบสำรวจ</h3>{error && <p style={{ color: '#b91c1c' }}>{error}</p>}<table className='admin-table'><thead><tr><th>แบบสำรวจ</th><th>สมาชิก</th><th>โทร</th><th>เวลา</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.surveys?.title ?? '-'}</td><td>{r.members?.full_name ?? '-'}</td><td>{r.members?.phone ?? '-'}</td><td>{new Date(r.submitted_at).toLocaleString()}</td></tr>)}</tbody></table></div>;
}
