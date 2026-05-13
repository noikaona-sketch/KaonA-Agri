'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';

type Notif = {
  id: string; title: string; body: string;
  read_at: string | null; created_at: string;
  related_resource_type: string | null;
  related_resource_id: string | null;
};

function getHref(n: Notif): string | null {
  if (!n.related_resource_type || !n.related_resource_id) return null;
  const map: Record<string, string> = {
    planting_cycle: `/planting-cycles/${n.related_resource_id}`,
    sale_order: `/service/booking`,
    approval: '/',
  };
  return map[n.related_resource_type] ?? null;
}

export function NotificationsList() {
  const member = useCurrentMember();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member?.id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('notifications')
        .select('*').eq('member_id', member.id)
        .order('created_at', { ascending: false }).limit(50);
      setItems((data as Notif[]) ?? []);
      setLoading(false);
    })();
  }, [member?.id]);

  async function markRead(id: string) {
    const s = createSupabaseBrowserClient();
    await s.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function markAllRead() {
    const s = createSupabaseBrowserClient();
    await s.from('notifications').update({ read_at: new Date().toISOString() }).eq('member_id', member!.id).is('read_at', null);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  const unreadCount = items.filter((n) => !n.read_at).length;

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div className="mobile-stack">
      {unreadCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{unreadCount} ยังไม่ได้อ่าน</span>
          <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            อ่านทั้งหมด
          </button>
        </div>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 48 }}>🔔</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0 0' }}>ไม่มีการแจ้งเตือน</p>
        </div>
      )}

      {items.map((n) => {
        const href = getHref(n);
        const isUnread = !n.read_at;
        const content = (
          <div className="activity-item" style={{ background: isUnread ? '#f1f8f1' : 'transparent', borderRadius: 12, padding: '10px 12px', margin: '0 -12px' }}
            onClick={() => { if (isUnread) markRead(n.id); }}>
            <div className="activity-dot" style={{ background: isUnread ? '#e8f5e9' : '#f5f5f5', fontSize: 18 }}>
              {isUnread ? '🔔' : '🔕'}
            </div>
            <div style={{ flex: 1 }}>
              <p className="activity-item__text" style={{ color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{n.title}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</p>
              <p className="activity-item__time">{new Date(n.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            {isUnread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />}
          </div>
        );
        return href ? <Link key={n.id} href={href} style={{ textDecoration: 'none' }}>{content}</Link> : <div key={n.id}>{content}</div>;
      })}
    </div>
  );
}
