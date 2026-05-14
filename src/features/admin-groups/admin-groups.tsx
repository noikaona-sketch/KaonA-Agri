'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';

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
    id: string; created_at: string;
    members: { id: string; full_name: string; phone: string | null; status: string }[] | null;
  }[];                                                  // members = array — nested relation
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
    const res = await fetch('/api/admin/groups');
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
    const res = await fetch('/api/admin/groups', {
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, added_by: '00000000-0000-0000-0000-000000000001' }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setAddingId(null);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setSearch(''); setSearchRes([]);
    await openGroup(selected.id);
    await load();
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
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 20 }}>

      {/* Left: group list */}
      <div>
        {notice && (
          <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
            {notice}
          </div>
        )}
        {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

        <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{groups.length} กลุ่ม</p>
          <button className="admin-btn admin-btn--primary" onClick={() => setShowNew(true)} style={{ marginLeft: 'auto' }}>
            ➕ สร้างกลุ่มใหม่
          </button>
        </div>

        {/* create group form */}
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
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48 }}>🗂️</div>
            <p style={{ margin: '8px 0 0' }}>ยังไม่มีกลุ่ม</p>
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {groups.map((g) => (
            <div key={g.id}
              onClick={() => openGroup(g.id)}
              style={{ background: selected?.id === g.id ? '#e8f5e9' : '#fff', border: `1.5px solid ${selected?.id === g.id ? '#a5d6a7' : '#e8ede8'}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                🗂️
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{g.name}</p>
                {g.description && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{g.description}</p>}
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                  👥 {memberCount(g)} คน · {new Date(g.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button className="admin-btn admin-btn--danger"
                onClick={(e) => { e.stopPropagation(); void deleteGroup(g.id, g.name); }}
                style={{ fontSize: 12, minHeight: 30, padding: '4px 8px', flexShrink: 0 }}>
                ลบ
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right: group detail */}
      {selected && (
        <div style={{ background: '#f7faf7', border: '1px solid #e8ede8', borderRadius: 14, padding: 20, display: 'grid', gap: 16, alignContent: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0d3d1f' }}>{selected.name}</h3>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
          </div>
          {selected.description && <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{selected.description}</p>}

          {/* เพิ่มสมาชิก */}
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14 }}>➕ เพิ่มสมาชิก</p>
            <input className="admin-search" placeholder="พิมพ์ชื่อหรือเบอร์…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
            {searching && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>กำลังค้นหา…</p>}
            {searchRes.length > 0 && (
              <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                {searchRes.map((m) => {
                  const alreadyIn = selected.member_group_members.some((x) => x.members?.[0]?.id === m.id);
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fff', borderRadius: 10, border: '1px solid #e8ede8' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{m.full_name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m.phone ?? '—'}</p>
                      </div>
                      {alreadyIn ? (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>อยู่แล้ว</span>
                      ) : (
                        <button className="admin-btn admin-btn--success"
                          onClick={() => addMember(m.id)} disabled={addingId !== null}
                          style={{ fontSize: 12, minHeight: 30, padding: '4px 10px' }}>
                          {addingId === m.id ? '…' : '+ เพิ่ม'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* รายชื่อสมาชิก */}
          <div>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14 }}>
              👥 สมาชิกในกลุ่ม ({selected.member_group_members.length} คน)
            </p>
            {selected.member_group_members.length === 0 && (
              <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>ยังไม่มีสมาชิก</p>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {selected.member_group_members.map((gm) => (
                <div key={gm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', borderRadius: 10, border: '1px solid #e8ede8' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0, color: '#2e7d32' }}>
                    {gm.members?.[0]?.full_name?.[0] ?? '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{gm.members?.[0]?.full_name ?? '—'}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{gm.members?.[0]?.phone ?? '—'}</p>
                  </div>
                  <button className="admin-btn admin-btn--danger"
                    onClick={() => gm.members?.[0] && removeMember(gm.members[0].id)}
                    disabled={addingId !== null}
                    style={{ fontSize: 12, minHeight: 30, padding: '4px 8px', flexShrink: 0 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
