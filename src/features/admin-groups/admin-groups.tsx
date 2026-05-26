'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState }   from '@/shared/components/error-state';
import { Drawer }       from '@/shared/components/drawer';

/* ─── Types ─── */
// IMPORTANT: Supabase nested select ALWAYS returns array, even for FK (1:1)
// Access with: item.members?.[0]?.full_name NOT item.members?.full_name
// See: docs/SUPABASE_RULES.md

type Group = {
  id: string; name: string; description: string | null; created_at: string;
  created_by_member: { full_name: string }[] | null;   // array — nested relation
  member_group_members: { count: number }[];
};
type GroupDetail = {
  id: string; name: string; description: string | null; created_at: string;
  created_by_member: { full_name: string }[] | null;
  member_group_members: {
    id: string; created_at: string; is_leader?: boolean;
    member: { id: string; full_name: string; phone: string | null; status: string } | null;
  }[];
};
type SearchMember = { id: string; full_name: string; phone: string | null };

/* ─── AdminGroups ─── */
export function AdminGroups() {
  const [groups, setGroups]   = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [selected, setSelected] = useState<GroupDetail | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving]   = useState(false);

  // member search
  const [search, setSearch]       = useState('');
  const [searchRes, setSearchRes] = useState<SearchMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId]   = useState<string | null>(null);

  /* load all groups */
  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/groups', { credentials: 'include' });
    const d = (await res.json()) as { groups?: Group[]; error?: string };
    if (!res.ok) { setError(d.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setGroups(d.groups ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  /* load group detail */
  async function openGroup(id: string) {
    const res = await fetch(`/api/admin/groups/${id}`);
    const d = (await res.json()) as { group?: GroupDetail; error?: string };
    if (res.ok) setSelected(d.group ?? null);
  }

  /* create group */
  async function createGroup() {
    if (!newName.trim()) return;
    setSaving(true);
    // ใช้ admin placeholder id — API ใช้ service role ไม่ต้องการ real user
    const res = await fetch('/api/admin/groups', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc || undefined, created_by: '00000000-0000-0000-0000-000000000001' }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ สร้างกลุ่มแล้ว'); setShowNew(false); setNewName(''); setNewDesc('');
    await load();
  }

  /* search members */
  useEffect(() => {
    if (search.length < 1) { setSearchRes([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/admin/members?search=${encodeURIComponent(search)}&limit=10`);
      const d = (await res.json()) as { members?: SearchMember[] };
      setSearchRes(d.members ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  /* add member to group */
  async function addMember(memberId: string) {
    if (!selected) return;
    setAddingId(memberId);
    const res = await fetch(`/api/admin/groups/${selected.id}/members`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setAddingId(null);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setSearch(''); setSearchRes([]);
    await openGroup(selected.id);
    await load();
  }

  /* set leader */
  async function setLeader(memberId: string, isLeader: boolean) {
    if (!selected) return;
    await fetch(`/api/admin/groups/${selected.id}/members`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, is_leader: isLeader }),
    });
    await openGroup(selected.id);
    setNotice(isLeader ? '👑 ตั้งเป็นหัวหน้ากลุ่มแล้ว' : '✅ ยกเลิกหัวหน้าแล้ว');
  }

  /* remove member */
  async function removeMember(memberId: string) {
    if (!selected || !window.confirm('ลบสมาชิกนี้ออกจากกลุ่ม?')) return;
    setAddingId(memberId);
    await fetch(`/api/admin/groups/${selected.id}/members`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    });
    setAddingId(null);
    await openGroup(selected.id);
    await load();
  }

  /* delete group */
  async function deleteGroup(id: string, name: string) {
    if (!window.confirm(`ลบกลุ่ม "${name}"?`)) return;
    await fetch(`/api/admin/groups/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    setNotice('⛔ ลบกลุ่มแล้ว');
    await load();
  }

  const memberCount = (g: Group) => g.member_group_members?.[0]?.count ?? 0;

  /* ─── UI ─── */
  return (
    <div>
      {notice && (
        <div style={{ background: notice.startsWith('✅')||notice.startsWith('👑') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅')||notice.startsWith('👑') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅')||notice.startsWith('👑') ? '#1b5e20' : '#c62828' }}>
          {notice}
        </div>
      )}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{groups.length} กลุ่ม</p>
        <button className="admin-btn admin-btn--primary" onClick={() => setShowNew(true)} style={{ marginLeft: 'auto' }}>
          ➕ สร้างกลุ่มใหม่
        </button>
      </div>

      {/* Create group form */}
      {showNew && (
        <div className="kaona-card" style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 15 }}>➕ สร้างกลุ่มใหม่</p>
          <label className="reg-label">ชื่อกลุ่ม <span className="reg-required">*</span>
            <input className="reg-input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="กลุ่มเกษตรกรตำบล…" />
          </label>
          <label className="reg-label" style={{ marginTop: 8 }}>รายละเอียด
            <input className="reg-input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="คำอธิบายกลุ่ม…" />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <button className="admin-btn admin-btn--ghost" onClick={() => { setShowNew(false); setNewName(''); setNewDesc(''); }}>ยกเลิก</button>
            <button className="admin-btn admin-btn--primary" onClick={createGroup} disabled={saving || !newName.trim()}>
              {saving ? '…' : '💾 สร้าง'}
            </button>
          </div>
        </div>
      )}

      {loading && <LoadingState label="กำลังโหลด…" />}

      {!loading && groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 52 }}>🏘️</div>
          <p style={{ margin: '12px 0 4px', fontWeight: 600, fontSize: 15 }}>ยังไม่มีกลุ่ม</p>
          <p style={{ fontSize: 13 }}>กด "สร้างกลุ่มใหม่" เพื่อเริ่มต้น</p>
        </div>
      )}

      {/* Group grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {groups.map((g) => (
          <div key={g.id}
            onClick={() => openGroup(g.id)}
            style={{ background: '#fff', border: '1.5px solid #e8ede8', borderRadius: 14, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#40916C', e.currentTarget.style.boxShadow = '0 2px 12px rgba(64,145,108,.12)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8ede8', e.currentTarget.style.boxShadow = 'none')}>
            {/* ไอคอนกลุ่ม */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                🏘️
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#111' }}>{g.name}</p>
                {g.description && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.description}</p>}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); void deleteGroup(g.id, g.name); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, padding: '2px 6px', borderRadius: 6, flexShrink: 0, opacity: 0.6 }}
                title="ลบกลุ่ม">✕</button>
            </div>
            {/* Stats */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>👥 {memberCount(g)} สมาชิก</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#40916C', background: '#e8f5e9', padding: '3px 10px', borderRadius: 99 }}>
                จัดการ →
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Drawer — รายละเอียดกลุ่ม */}
      <Drawer
        open={!!selected}
        onClose={() => { setSelected(null); setSearch(''); setSearchRes([]); }}
        title={`🏘️ ${selected?.name ?? ''}`}
        width={480}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {selected.description && (
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', background: '#f9fafb', padding: '10px 14px', borderRadius: 8 }}>
                {selected.description}
              </p>
            )}

            {/* เพิ่มสมาชิก */}
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: '#111' }}>➕ เพิ่มสมาชิก</p>
              <input
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box' }}
                placeholder="พิมพ์ชื่อหรือเบอร์โทรเพื่อค้นหา…"
                value={search}
                onChange={(e) => setSearch(e.target.value)} />
              {searching && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>⏳ กำลังค้นหา…</p>}
              {searchRes.length > 0 && (
                <div style={{ marginTop: 8, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                  {searchRes.map((m) => {
                    const alreadyIn = selected.member_group_members.some((x) => x.member?.id === m.id);
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #F3F4F6', background: alreadyIn ? '#F9FAFB' : '#fff' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#2e7d32', flexShrink: 0 }}>
                          {m.full_name?.[0] ?? '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{m.full_name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{m.phone ?? '—'}</p>
                        </div>
                        {alreadyIn ? (
                          <span style={{ fontSize: 11, color: '#9ca3af', padding: '3px 8px', background: '#F3F4F6', borderRadius: 6 }}>อยู่แล้ว</span>
                        ) : (
                          <button
                            onClick={() => addMember(m.id)}
                            disabled={addingId !== null}
                            style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#16A34A', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                            {addingId === m.id ? '…' : '+ เพิ่ม'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {search && !searching && searchRes.length === 0 && (
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>ไม่พบสมาชิก</p>
              )}
            </div>

            {/* รายชื่อสมาชิก */}
            <div>
              <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14, color: '#111' }}>
                👥 สมาชิกในกลุ่ม ({selected.member_group_members.length} คน)
              </p>
              {selected.member_group_members.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', background: '#F9FAFB', borderRadius: 10, fontSize: 13 }}>
                  ยังไม่มีสมาชิก — ค้นหาและเพิ่มด้านบน
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.member_group_members.map((gm) => (
                  <div key={gm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: gm.is_leader ? '#FFFBEB' : '#fff', borderRadius: 10, border: `1.5px solid ${gm.is_leader ? '#FCD34D' : '#E5E7EB'}` }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: gm.is_leader ? '#FEF3C7' : '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, flexShrink: 0, color: gm.is_leader ? '#92400E' : '#2e7d32' }}>
                      {gm.is_leader ? '👑' : (gm.member?.full_name?.[0] ?? '?')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{gm.member?.full_name ?? '—'}</p>
                        {gm.is_leader && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: '#FCD34D', color: '#92400E', fontWeight: 700 }}>หัวหน้ากลุ่ม</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{gm.member?.phone ?? '—'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => gm.member && setLeader(gm.member.id, !gm.is_leader)}
                        title={gm.is_leader ? 'ยกเลิกหัวหน้า' : 'ตั้งเป็นหัวหน้ากลุ่ม'}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: gm.is_leader ? '#FFFBEB' : '#fff', cursor: 'pointer', fontSize: 14 }}>
                        {gm.is_leader ? '👤' : '👑'}
                      </button>
                      <button
                        onClick={() => gm.member && removeMember(gm.member.id)}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #FECDD3', background: '#FFF1F2', color: '#DC2626', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
