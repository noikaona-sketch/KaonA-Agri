'use client';

// ─────────────────────────────────────────────────────────────────────────────
// AdminHarvestQueue — P2 PR2 + #253 extension
// Queue visibility + manual admin planning fields.
// No auto-scheduling, no GPS, no optimization.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState }         from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState }                  from '@/shared/components/error-state';
import { LoadingState }                from '@/shared/components/loading-state';
import { HarvestQueueSummary }   from './harvest-queue-summary';
import { HarvestEmptyState }     from './harvest-data-quality';
import { HarvestQueueRow }             from './harvest-queue-row';
import type { QueueRow, EditDraft }    from './harvest-queue-row';

const QUEUE_SELECT =
  'id,member_id,scheduled_date,status,actual_yield_kg,drying_preference,delivery_type,' +
  'estimated_moisture_pct,note,member_name,member_phone,' +
  'plot_name,plot_province,crop_name,area_planted_rai,' +
  'planned_delivery_date,assigned_dryer,admin_note,priority_score';

function emptyDraft(r: QueueRow): EditDraft {
  return {
    planned_delivery_date: r.planned_delivery_date ?? '',
    assigned_dryer:        r.assigned_dryer        ?? '',
    admin_note:            r.admin_note            ?? '',
    priority_score:        r.priority_score != null ? String(r.priority_score) : '',
  };
}

export function AdminHarvestQueue() {
  const [rows,     setRows]     = useState<QueueRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [acting,   setActing]   = useState<string | null>(null);
  const [drafts,   setDrafts]   = useState<Record<string, EditDraft>>({});
  const [filter,       setFilter]       = useState<'pending' | 'confirmed' | 'all'>('pending');
  const [reliabilityMap, setReliabilityMap] = useState<Record<string, import('./harvest-reliability').ReliabilityStats>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  async function load() {
    setLoading(true); setError(null);
    const s = createSupabaseBrowserClient();
    let q = s.from('harvest_bookings_full').select(QUEUE_SELECT)
      .order('scheduled_date', { ascending: true }).limit(200);
    if (filter !== 'all') q = q.eq('status', filter);
    // Date filter on planned_delivery_date (admin plan date, not scheduled_date)
    if (dateFrom) q = q.gte('planned_delivery_date', dateFrom);
    if (dateTo)   q = q.lte('planned_delivery_date', dateTo);
    const { data, error: err } = await q;
    if (err) { setError(err.message); setLoading(false); return; }
    const loaded = (data as unknown as QueueRow[]) ?? [];
    setRows(loaded);
    // Initialise drafts from loaded data (preserve unsaved edits if row already in draft)
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of loaded) {
        if (!next[r.id]) next[r.id] = emptyDraft(r);
      }
      return next;
    });
    setLoading(false);
    // Load reliability stats for all unique members in results
    const memberIds = [...new Set((loaded).map((r) => r.member_id).filter(Boolean))] as string[];
    if (memberIds.length > 0) {
      const sb = createSupabaseBrowserClient();
      const { data: bookings } = await sb.from('harvest_bookings')
        .select('member_id,status').in('member_id', memberIds);
      if (bookings) {
        const map: Record<string, import('./harvest-reliability').ReliabilityStats> = {};
        for (const mid of memberIds) {
          const mb = (bookings as {member_id:string;status:string}[]).filter((b) => b.member_id === mid);
          const completed = mb.filter((b) => b.status === 'completed').length;
          const cancelled = mb.filter((b) => b.status === 'cancelled').length;
          const no_show   = mb.filter((b) => b.status === 'no_show').length;
          const pending   = mb.filter((b) => b.status === 'pending' || b.status === 'confirmed').length;
          const total     = mb.length;
          const cancelRate = total > 0 ? Math.round((cancelled/total)*100) : 0;
          const noShowRate = total > 0 ? Math.round((no_show/total)*100) : 0;
          map[mid] = { completed, cancelled, no_show, pending, total, cancelRate, noShowRate };
        }
        setReliabilityMap(map);
      }
    }
  }

  useEffect(() => { void load(); }, [filter, dateFrom, dateTo]);

  // Save planning fields only (no status change)
  async function savePlan(id: string) {
    const d = drafts[id];
    if (!d) return;
    setActing(id);
    const s = createSupabaseBrowserClient();
    const { error: saveErr } = await s.from('harvest_bookings').update({
      planned_delivery_date: d.planned_delivery_date || null,
      assigned_dryer:        d.assigned_dryer.trim()  || null,
      admin_note:            d.admin_note.trim()       || null,
      priority_score:        d.priority_score !== '' ? Number(d.priority_score) : null,
    }).eq('id', id);
    setActing(null);
    if (saveErr) { setError(saveErr.message); return; }
    await load();
  }

  // Status transitions
  async function transition(id: string, newStatus: 'confirmed' | 'completed' | 'no_show') {
    setActing(id);
    const s = createSupabaseBrowserClient();
    const { error: txErr } = await s.from('harvest_bookings')
      .update({ status: newStatus }).eq('id', id);
    setActing(null);
    if (txErr) { setError(txErr.message); return; }
    await load();
  }

  const active           = rows.filter((r) => r.status === 'pending' || r.status === 'confirmed');
  const dryerLoad        = active.filter((r) => r.drying_preference === 'required').length;
  const estimatedTonnage = active.reduce((sum, r) => sum + (r.actual_yield_kg ?? 0), 0);

  return (
    <div>
      <HarvestQueueSummary
        pendingCount={rows.filter((r) => r.status === 'pending').length}
        confirmedCount={rows.filter((r) => r.status === 'confirmed').length}
        dryerLoad={dryerLoad}
        estimatedTonnage={estimatedTonnage}
      />

      {/* ── Filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        {(['pending', 'confirmed', 'all'] as const).map((f) => (
          <button key={f}
            className={`admin-btn ${filter === f ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            onClick={() => setFilter(f)} style={{ fontSize: 12, padding: '6px 12px' }}>
            {f === 'pending' ? '⏳ รอยืนยัน' : f === 'confirmed' ? '✅ ยืนยันแล้ว' : '📋 ทั้งหมด'}
          </button>
        ))}

        {/* Date range filter on planned_delivery_date */}
        <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          วันส่งตั้งแต่
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={{ fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', padding: '4px 8px' }} />
        </label>
        <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          ถึง
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={{ fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', padding: '4px 8px' }} />
        </label>
        {(dateFrom || dateTo) && (
          <button className="admin-btn admin-btn--secondary" style={{ fontSize: 12 }}
            onClick={() => { setDateFrom(''); setDateTo(''); }}>
            ✕ ล้างวันที่
          </button>
        )}
      </div>

      {loading && <LoadingState label="กำลังโหลดคิว…" />}
      {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}
      {!loading && !error && rows.length === 0 && (
        <HarvestEmptyState message="ไม่มีรายการในคิว" />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>สมาชิก / แปลง</th><th>พืช / ไร่</th>
                <th>วันเกี่ยวคาด</th><th>น้ำหนักคาด</th>
                <th>การอบ / ส่ง</th><th>ความชื้น%</th>
                <th>สถานะ</th>
                <th style={{ minWidth: 220 }}>แผน / ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <HarvestQueueRow key={r.id} r={r} acting={acting}
                  draft={drafts[r.id] ?? emptyDraft(r)}
                  onDraft={(d) => setDrafts((prev) => ({
                    ...prev, [r.id]: { ...(prev[r.id] ?? emptyDraft(r)), ...d },
                  }))}
                  onSavePlan={() => void savePlan(r.id)}
                  onConfirm={()  => void transition(r.id, 'confirmed')}
                  onComplete={() => void transition(r.id, 'completed')}
                  onNoShow={()   => void transition(r.id, 'no_show')}
                  reliabilityStats={r.member_id ? (reliabilityMap[r.member_id] ?? null) : null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
