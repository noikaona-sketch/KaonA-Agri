'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type CampaignType = 'price_notice' | 'no_burn_program' | 'pest_alert' | 'queue_notice' | 'general';

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  type: CampaignType;
  start_date: string;
  end_date: string;
};

const TYPE_LABEL: Record<CampaignType, string> = {
  price_notice: '💹 แจ้งราคา',
  no_burn_program: '🔥 งดเผา',
  pest_alert: '🐛 ศัตรูพืช',
  queue_notice: '🚜 คิวบริการ',
  general: '📢 ทั่วไป',
};

export function MemberAnnouncementsList() {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s
      .from('campaign_announcements')
      .select('id,title,body,type,start_date,end_date')
      .eq('is_active', true)
      .lte('start_date', new Date().toISOString().slice(0, 10))
      .gte('end_date', new Date().toISOString().slice(0, 10))
      .order('start_date', { ascending: false })
      .limit(10)
      .then(({ data }) => setRows((data as AnnouncementRow[] | null) ?? []));
  }, []);

  if (rows.length === 0) return null;

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary,#888)', fontWeight: 500, letterSpacing: '.04em', margin: '0 0 8px' }}>
        ประกาศล่าสุด
      </p>
      <div style={{ background: '#fff', border: '0.5px solid var(--color-border-tertiary,#e4ede4)', borderRadius: 14, padding: 12, display: 'grid', gap: 8 }}>
        {rows.map((row) => (
          <div key={row.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{row.title}</p>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{TYPE_LABEL[row.type]}</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{row.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
