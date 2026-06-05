'use client';

// AdminVisitLogPanel — แสดง visit logs ทั้งหมด + "รอระบุสมาชิก"
// staff/admin ระบุสมาชิกทีหลังได้จากหน้านี้

import { useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type MemberHit = { id: string; full_name: string; phone: string | null; province: string | null };

type VisitLog = {
  id: string;
  visit_purpose: string; visit_purpose_note: string | null;
  note: string | null; follow_up: string | null;
  gps_lat: number | null; gps_lng: number | null;
  visited_at: string;
  member_id: string | null;
  member: { id: string; full_name: string } | null;
  staff: { id: string; full_name: string } | null;
  plots: { id: string; name: string } | null;
  photos: { id: string; storage_path: string }[];
};

const PURPOSE_TH: Record<string, string> = {
  follow_up:'🌱 ติดตามปลูก', no_burn_advice:'🌿 แนะนำไม่เผา',
  soil_check:'🪱 ตรวจดิน',   pest_advice:'🐛 ศัตรูพืช',
  registration:'📋 ลงทะเบียน', problem_solve:'🔧 แก้ปัญหา', other:'💬 อื่นๆ',
};

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}

// ── Member link modal ─────────────────────────────────────────────────────────
function LinkMemberModal({ logId, onLinked, onClose }: {
  logId: string;
  onLinked: (m: MemberHit) => void;
  onClose: () => void;
}) {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState<MemberHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  async function search(val: string) {
    setQ(val);
    if (val.length < 2) { setResults([]); return; }
    setLoading(true);
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }
    const { data } = await sb.from('members')
      .select('id,full_name,phone,province')
      .eq('status', 'approved')
      .or(`full_name.ilike.%${val}%,phone.ilike.%${val}%,province.ilike.%${val}%`)
      .limit(10);
    setResults((data as MemberHit[]) ?? []);
    setLoading(false);
  }

  async function link(m: MemberHit) {
    setSaving(true); setErr(null);
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setErr('ไม่สามารถเชื่อมต่อได้'); setSaving(false); return; }
    const { error } = await sb.from('field_visit_logs')
      .update({ member_id: m.id, updated_at: new Date().toISOString() })
      .eq('id', logId);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onLinked(m);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>🔗 ระบุสมาชิก</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 12, marginBottom: 10 }}>{err}</div>}
        <input
          value={q} onChange={e => search(e.target.value)}
          placeholder="ชื่อ / เบอร์ / จังหวัด…" autoFocus
          style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 10 }}
        />
        {loading && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>กำลังค้นหา…</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(m => (
            <button key={m.id} onClick={() => link(m)} disabled={saving}
              style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.full_name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{m.phone ?? '—'}{m.province ? ` · ${m.province}` : ''}</div>
            </button>
          ))}
        </div>
        {saving && <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 12 }}>กำลังบันทึก…</p>}
      </div>
    </div>
  );
}

// ── Log card ──────────────────────────────────────────────────────────────────
function LogCard({ log, onLinked }: { log: VisitLog; onLinked: (m: MemberHit) => void }) {
  const [showLink, setShowLink] = useState(false);
  const sb = tryCreateSupabaseBrowserClient();

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${log.member_id ? '#e5e7eb' : '#fcd34d'}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px' }}>
        {/* Purpose + staff */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
              {PURPOSE_TH[log.visit_purpose] ?? log.visit_purpose}
              {log.visit_purpose_note ? ` — ${log.visit_purpose_note}` : ''}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
              📅 {fmtDate(log.visited_at)} · 👤 {log.staff?.full_name ?? '—'}
              {log.gps_lat ? (
                <a href={`https://maps.google.com/?q=${log.gps_lat},${log.gps_lng}`}
                  target="_blank" rel="noreferrer"
                  style={{ marginLeft: 6, color: '#2563eb', textDecoration: 'none' }}>
                  📍 แผนที่
                </a>
              ) : null}
            </p>
          </div>
          {/* Member badge */}
          {log.member_id ? (
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, whiteSpace: 'nowrap' }}>
              👤 {log.member?.full_name ?? '—'}
            </span>
          ) : (
            <button onClick={() => setShowLink(true)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: '#fffbeb', color: '#92400e', fontWeight: 700, border: '1px solid #fcd34d', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ⚠️ ระบุสมาชิก
            </button>
          )}
        </div>

        {/* Note + follow-up */}
        {log.note && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>📝 {log.note}</p>
        )}
        {log.follow_up && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#92400e', background: '#fffbeb', padding: '4px 10px', borderRadius: 7 }}>
            ⚡ ติดตาม: {log.follow_up}
          </p>
        )}

        {/* Photos */}
        {log.photos?.length > 0 && sb && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {log.photos.map(p => {
              const { data } = sb.storage.from(EVIDENCE_BUCKET).getPublicUrl(p.storage_path);
              return (
                <a key={p.id} href={data.publicUrl} target="_blank" rel="noreferrer"
                  style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', display: 'block', border: '1px solid #e5e7eb' }}>
                  <img src={data.publicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </a>
              );
            })}
          </div>
        )}
      </div>

      {showLink && (
        <LinkMemberModal
          logId={log.id}
          onLinked={m => { onLinked(m); setShowLink(false); }}
          onClose={() => setShowLink(false)}
        />
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function AdminVisitLogPanel() {
  const [logs,     setLogs]     = useState<VisitLog[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'all' | 'unlinked'>('all');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }
    void sb.from('field_visit_logs')
      .select(`
        id, visit_purpose, visit_purpose_note, note, follow_up,
        gps_lat, gps_lng, visited_at, member_id,
        member:member_id(id, full_name),
        staff:staff_member_id(id, full_name),
        plots(id, name),
        photos!field_visit_log_id(id, storage_path)
      `)
      .order('visited_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setLogs((data as unknown as VisitLog[]) ?? []); setLoading(false); });
  }, []);

  const filtered = logs.filter(l => {
    if (filter === 'unlinked' && l.member_id) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (l.member?.full_name ?? '').toLowerCase().includes(q) ||
        (l.staff?.full_name  ?? '').toLowerCase().includes(q) ||
        (l.note              ?? '').toLowerCase().includes(q) ||
        (PURPOSE_TH[l.visit_purpose] ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unlinkedCount = logs.filter(l => !l.member_id).length;

  if (loading) return <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา ชื่อ / วัตถุประสงค์ / บันทึก…"
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'unlinked'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${filter===f ? '#2e7d32' : '#e5e7eb'}`, background: filter===f ? '#e8f5e9' : '#fff', color: filter===f ? '#1b5e20' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {f === 'all' ? `ทั้งหมด (${logs.length})` : `⚠️ รอระบุสมาชิก (${unlinkedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Logs */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: 32, margin: '0 0 8px' }}>🤝</p>
          <p style={{ fontSize: 13 }}>{filter === 'unlinked' ? 'ไม่มี log ที่รอระบุสมาชิก' : 'ไม่พบ log'}</p>
        </div>
      ) : (
        filtered.map(log => (
          <LogCard
            key={log.id}
            log={log}
            onLinked={m => setLogs(prev => prev.map(l => l.id === log.id ? { ...l, member_id: m.id, member: m } : l))}
          />
        ))
      )}
    </div>
  );
}
