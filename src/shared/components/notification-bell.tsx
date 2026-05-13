'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCurrentMember } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function NotificationBell() {
  const member = useCurrentMember();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!member?.member_id) return;
    let cancelled = false;

    void (async () => {
      const s = createSupabaseBrowserClient();
      const { count } = await s.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', member.member_id)
        .is('read_at', null);
      if (!cancelled) setUnread(count ?? 0);
    })();

    // realtime subscription
    const s = createSupabaseBrowserClient();
    const channel = s
      .channel(`notif_${member.member_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `member_id=eq.${member.member_id}`,
      }, () => setUnread((p) => p + 1))
      .subscribe();

    return () => {
      cancelled = true;
      void s.removeChannel(channel);
    };
  }, [member?.member_id]);

  return (
    <Link href="/notifications" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', textDecoration: 'none', flexShrink: 0 }}>
      <span style={{ fontSize: 20 }}>🔔</span>
      {unread > 0 && (
        <span style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
