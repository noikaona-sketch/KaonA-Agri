'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Member = { id: string; full_name: string; phone: string | null };

type Props = {
  onSelect: (m: Member) => void;
  onClose: () => void;
};

export function PosMemberPicker({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 1) { setMembers([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('members')
        .select('id,full_name,phone')
        .eq('status', 'approved')
        .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(20);
      setMembers((data as Member[]) ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" style={{ maxWidth: 420 }}>
        <div className="admin-modal__header">
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>เลือกสมาชิก</h2>
          <button className="admin-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="admin-modal__body">
          <input className="admin-search" autoFocus placeholder="พิมพ์ชื่อหรือเบอร์โทร…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {loading && <p style={{ fontSize: 13, color: '#6b7280' }}>กำลังค้นหา…</p>}
          <div style={{ display: 'grid', gap: 4 }}>
            {members.map((m) => (
              <button key={m.id} onClick={() => onSelect(m)}
                style={{ background: '#f7faf7', border: '1px solid #e8ede8', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e8f5e9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f7faf7')}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{m.full_name}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m.phone ?? '—'}</p>
              </button>
            ))}
            {!loading && search.length > 0 && members.length === 0 && (
              <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>ไม่พบสมาชิก</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
