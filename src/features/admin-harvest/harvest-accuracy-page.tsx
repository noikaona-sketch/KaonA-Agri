'use client';

import { useEffect, useState }         from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState }                  from '@/shared/components/error-state';
import { LoadingState }                from '@/shared/components/loading-state';
import { HarvestAccuracySummary, computeStats } from './harvest-accuracy-summary';
import { buildHarvestCsv, downloadCsv, todayFilename } from './harvest-export';
import type { ExportRow } from './harvest-export';
import { HarvestEmptyState }                        from './harvest-data-quality';
import { HarvestAccuracyTable }        from './harvest-accuracy-table';
import type { AccuracyRow }            from './harvest-accuracy-summary';

const SELECT =
  'id,actual_yield_kg,estimated_moisture_pct,actual_received_kg,' +
  'actual_moisture_pct,actual_completed_at,admin_note,' +
  'member_name,member_phone,plot_name,crop_name';

export function HarvestAccuracyPage() {
  const [rows,     setRows]     = useState<AccuracyRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [crop,     setCrop]     = useState('');

  async function load() {
    setLoading(true); setError(null);
    const s = createSupabaseBrowserClient();
    let q = s
      .from('harvest_bookings_full')
      .select(SELECT)
      .eq('status', 'completed')
      .not('actual_received_kg', 'is', null)
      .order('actual_completed_at', { ascending: false })
      .limit(300);
    if (dateFrom) q = q.gte('actual_completed_at', dateFrom);
    if (dateTo)   q = q.lte('actual_completed_at', dateTo + 'T23:59:59');
    if (crop)     q = q.ilike('crop_name', `%${crop}%`);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setRows((data as unknown as AccuracyRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [dateFrom, dateTo, crop]);

  const stats = computeStats(rows);

  function handleExport() {
    const exportRows: ExportRow[] = rows.map((r) => ({
      actual_completed_at:    r.actual_completed_at,
      member_name:            r.member_name,
      member_phone:           r.member_phone,
      plot_name:              r.plot_name,
      crop_name:              r.crop_name,
      actual_yield_kg:        r.actual_yield_kg,
      actual_received_kg:     r.actual_received_kg,
      estimated_moisture_pct: r.estimated_moisture_pct,
      actual_moisture_pct:    r.actual_moisture_pct,
      status:                 'completed',
      admin_note:             r.admin_note,
    }));
    downloadCsv(buildHarvestCsv(exportRows), todayFilename());
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          พืช
          <input value={crop} onChange={(e) => setCrop(e.target.value)}
            placeholder="ทั้งหมด" style={{ fontSize: 12, borderRadius: 6,
              border: '1px solid #d1d5db', padding: '4px 8px', width: 100 }} />
        </label>
        <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          เสร็จตั้งแต่
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            style={{ fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', padding: '4px 8px' }} />
        </label>
        <label style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          ถึง
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            style={{ fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', padding: '4px 8px' }} />
        </label>
        {(dateFrom || dateTo || crop) && (
          <button className="admin-btn admin-btn--secondary" style={{ fontSize: 12 }}
            onClick={() => { setDateFrom(''); setDateTo(''); setCrop(''); }}>
            ✕ ล้าง
          </button>
        )}
        <button
          className="admin-btn admin-btn--secondary"
          style={{ fontSize: 12, marginLeft: 'auto' }}
          disabled={rows.length === 0 || loading}
          onClick={handleExport}
        >
          ⬇️ Export CSV ({rows.length} รายการ)
        </button>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <>
          <HarvestAccuracySummary stats={stats} />
          <HarvestAccuracyTable rows={rows} />
        </>
      )}
    </div>
  );
}
