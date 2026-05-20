'use client';

import { FormEvent, useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type CampaignType = 'price_notice' | 'no_burn_program' | 'pest_alert' | 'queue_notice' | 'general';

type CampaignRow = {
  id: string;
  title: string;
  body: string;
  type: CampaignType;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
};

const TYPE_LABEL: Record<CampaignType, string> = {
  price_notice: '💹 แจ้งราคาผลผลิต',
  no_burn_program: '🔥 โครงการงดเผา',
  pest_alert: '🐛 เตือนศัตรูพืช',
  queue_notice: '🚜 แจ้งคิวบริการ',
  general: '📢 ประกาศทั่วไป',
};

const TODAY = new Date().toISOString().slice(0, 10);

export function AdminCampaignsManager() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<CampaignType>('general');
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);
  const [isActive, setIsActive] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    const s = createSupabaseBrowserClient();
    const { data, error: err } = await s
      .from('campaign_announcements')
      .select('id,title,body,type,start_date,end_date,is_active,created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (err) setError(err.message);
    else setRows((data as CampaignRow[] | null) ?? []);

    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setNotice('❌ กรุณากรอกหัวข้อและรายละเอียด');
      return;
    }
    if (endDate < startDate) {
      setNotice('❌ วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น');
      return;
    }

    setSubmitting(true);
    const s = createSupabaseBrowserClient();
    const { error: err } = await s.from('campaign_announcements').insert({
      title: title.trim(),
      body: body.trim(),
      type,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
    });
    setSubmitting(false);

    if (err) {
      setNotice(`❌ บันทึกไม่สำเร็จ: ${err.message}`);
      return;
    }

    setNotice('✅ บันทึกประกาศสำเร็จ');
    setTitle('');
    setBody('');
    setType('general');
    setStartDate(TODAY);
    setEndDate(TODAY);
    setIsActive(true);
    await load();
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {notice && (
        <div style={{ background: '#eef6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#1e3a8a' }}>
          {notice}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0 }}>สร้างประกาศใหม่</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="หัวข้อ" className="admin-input" maxLength={160} required />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="รายละเอียดประกาศ" rows={4} className="admin-input" required />

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            ประเภท
            <select className="admin-select" value={type} onChange={(e) => setType(e.target.value as CampaignType)}>
              {(Object.keys(TYPE_LABEL) as CampaignType[]).map((key) => (
                <option key={key} value={key}>{TYPE_LABEL[key]}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            เริ่มแสดง
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="admin-input" required />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            สิ้นสุดแสดง
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="admin-input" required />
          </label>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          เปิดใช้งานทันที
        </label>

        <div>
          <button className="admin-btn" disabled={submitting} style={{ background: '#1b5e20', color: '#fff' }}>
            {submitting ? 'กำลังบันทึก…' : 'บันทึกประกาศ'}
          </button>
        </div>
      </form>

      {loading && <LoadingState label="กำลังโหลดประกาศ…" />}
      {error && <ErrorState title="โหลดประกาศไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>หัวข้อ</th>
                <th>ประเภท</th>
                <th>ช่วงแสดงผล</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af' }}>ยังไม่มีประกาศ</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <p style={{ margin: 0, fontWeight: 600 }}>{row.title}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280', whiteSpace: 'pre-wrap' }}>{row.body}</p>
                  </td>
                  <td>{TYPE_LABEL[row.type]}</td>
                  <td>{row.start_date} → {row.end_date}</td>
                  <td>{row.is_active ? '✅ Active' : '⏸ Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
