'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';

// ─── Types ────────────────────────────────────────────────────────────────────

type VehicleSummary = {
  vehicle_id: string; vehicle_type: string; brand: string | null;
  plate_number: string | null; provider_name: string; provider_phone: string;
  total_jobs: number; completed_jobs: number; total_kg: number | null;
  grade_a_count: number; grade_b_count: number;
  grade_c_count: number; grade_reject_count: number;
  grade_a_pct: number | null; avg_moisture: number | null;
  avg_rating: number | null; avg_punctuality: number | null;
  avg_quality: number | null; avg_loss: number | null;
  rating_count: number; last_job_at: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_ICON: Record<string, string> = {
  harvester: '🌾', tractor: '🚜', transport: '🚛', water_pump: '💧', other: '🔧',
};

const GRADE_COLOR: Record<string, { bg: string; color: string }> = {
  A: { bg: '#e8f5e9', color: '#1b5e20' },
  B: { bg: '#e3f2fd', color: '#1565c0' },
  C: { bg: '#fff8e1', color: '#e65100' },
  reject: { bg: '#ffebee', color: '#c62828' },
};

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  if (!score) return null;
  const pct = (score / 5) * 100;
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: '#6b7280' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{score.toFixed(1)}/5</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: '#e5e7eb' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function GradeDonut({ summary }: { summary: VehicleSummary }) {
  const total = summary.grade_a_count + summary.grade_b_count +
                summary.grade_c_count + summary.grade_reject_count;
  if (total === 0) return <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>ยังไม่มีข้อมูลคุณภาพ</p>;

  const bars: { grade: string; count: number }[] = [
    { grade: 'A', count: summary.grade_a_count },
    { grade: 'B', count: summary.grade_b_count },
    { grade: 'C', count: summary.grade_c_count },
    { grade: 'reject', count: summary.grade_reject_count },
  ].filter((b) => b.count > 0);

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {bars.map((b) => {
        const cfg = GRADE_COLOR[b.grade];
        const pct = Math.round((b.count / total) * 100);
        return (
          <div key={b.grade} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, fontSize: 12, fontWeight: 800, color: cfg.color, textAlign: 'center' }}>
              {b.grade === 'reject' ? '✗' : b.grade}
            </span>
            <div style={{ flex: 1, height: 16, borderRadius: 4, background: '#f3f4f6', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: cfg.bg, border: `1px solid ${cfg.color}44`, transition: 'width .6s' }} />
            </div>
            <span style={{ fontSize: 11, color: '#6b7280', width: 44, textAlign: 'right' }}>
              {pct}% ({b.count})
            </span>
          </div>
        );
      })}
      {summary.avg_moisture && (
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
          💧 ความชื้นเฉลี่ย {summary.avg_moisture}%
        </p>
      )}
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function PopularityScore({ summary }: { summary: VehicleSummary }) {
  // คะแนนนิยม = รวม rating (40%) + % grade A (40%) + completion rate (20%)
  const ratingScore   = summary.avg_rating   ? (summary.avg_rating / 5) * 40   : 0;
  const qualityScore  = summary.grade_a_pct  ? (summary.grade_a_pct / 100) * 40 : 0;
  const completionRate = summary.total_jobs > 0 ? summary.completed_jobs / summary.total_jobs : 0;
  const completionScore = completionRate * 20;

  const total = Math.round(ratingScore + qualityScore + completionScore);

  const config =
    total >= 80 ? { label: 'ยอดเยี่ยม', color: '#1b5e20', bg: '#e8f5e9', emoji: '🏆' } :
    total >= 65 ? { label: 'ดีมาก',     color: '#2e7d32', bg: '#f0fdf4', emoji: '⭐' } :
    total >= 50 ? { label: 'ดี',         color: '#1565c0', bg: '#e3f2fd', emoji: '👍' } :
    total >= 30 ? { label: 'พอใช้',      color: '#e65100', bg: '#fff8e1', emoji: '📊' } :
    summary.total_jobs === 0
      ? { label: 'ยังไม่มีงาน', color: '#9ca3af', bg: '#f3f4f6', emoji: '—' }
      : { label: 'ต้องปรับปรุง', color: '#c62828', bg: '#ffebee', emoji: '⚠️' };

  return (
    <div style={{ textAlign: 'center', background: config.bg, border: `1.5px solid ${config.color}33`, borderRadius: 12, padding: '10px 14px', minWidth: 80 }}>
      <p style={{ margin: 0, fontSize: 10 }}>{config.emoji}</p>
      <p style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 900, color: config.color, lineHeight: 1 }}>{total}</p>
      <p style={{ margin: '2px 0 0', fontSize: 10, fontWeight: 700, color: config.color }}>{config.label}</p>
    </div>
  );
}

// ─── Vehicle Row ──────────────────────────────────────────────────────────────

function VehicleRow({ s, expanded, onToggle }: {
  s: VehicleSummary; expanded: boolean; onToggle: () => void;
}) {
  const icon = VEHICLE_ICON[s.vehicle_type] ?? '🔧';
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border,#d8e0db)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
      {/* Header row */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <PopularityScore summary={s} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>
              {s.brand ?? s.vehicle_type}
              {s.plate_number ? ` · ${s.plate_number}` : ''}
            </p>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>{s.provider_name}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', fontWeight: 600 }}>
              ✅ {s.completed_jobs}/{s.total_jobs} งาน
            </span>
            {s.total_kg && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #86efac', color: '#14532d', fontWeight: 600 }}>
                ⚖️ {(s.total_kg / 1000).toFixed(1)} ตัน
              </span>
            )}
            {s.avg_rating && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontWeight: 600 }}>
                ⭐ {s.avg_rating.toFixed(1)} ({s.rating_count})
              </span>
            )}
          </div>
        </div>
        <button onClick={onToggle}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: expanded ? '#f0fdf4' : '#fff', fontSize: 12, cursor: 'pointer', color: '#374151', flexShrink: 0 }}>
          {expanded ? '▲' : '▾'}
        </button>
      </div>

      {/* Detail panel */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '14px 16px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Quality */}
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13 }}>📊 คุณภาพข้าวโพด</p>
              <GradeDonut summary={s} />
            </div>
            {/* Ratings */}
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13 }}>⭐ คะแนนความพึงพอใจ</p>
              {s.rating_count === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>ยังไม่มีการให้คะแนน</p>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  <ScoreBar label="ตรงเวลา"     score={s.avg_punctuality} color="#1565c0" />
                  <ScoreBar label="คุณภาพงาน"  score={s.avg_quality}    color="#2e7d32" />
                  <ScoreBar label="ความสูญเสีย" score={s.avg_loss}       color="#e65100" />
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{s.provider_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>📞 {s.provider_phone}</p>
            </div>
            {s.last_job_at && (
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                งานล่าสุด {new Date(s.last_job_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AdminVehicleReport() {
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [sort,       setSort]       = useState<'score'|'quality'|'rating'|'jobs'>('score');
  const [expanded,   setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('vehicle_harvest_summary').select('*');
      setVehicles((data as VehicleSummary[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  // Sort
  const sorted = [...vehicles]
    .filter((v) => !typeFilter || v.vehicle_type === typeFilter)
    .sort((a, b) => {
      if (sort === 'quality') return (b.grade_a_pct ?? 0) - (a.grade_a_pct ?? 0);
      if (sort === 'rating')  return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
      if (sort === 'jobs')    return b.completed_jobs - a.completed_jobs;
      // score: composite
      const score = (v: VehicleSummary) =>
        (v.avg_rating ?? 0) / 5 * 40 +
        (v.grade_a_pct ?? 0) / 100 * 40 +
        (v.total_jobs > 0 ? v.completed_jobs / v.total_jobs : 0) * 20;
      return score(b) - score(a);
    });

  // Summary stats
  const totalJobs    = vehicles.reduce((s, v) => s + v.completed_jobs, 0);
  const totalTon     = vehicles.reduce((s, v) => s + (v.total_kg ?? 0), 0) / 1000;
  const avgGradeAPct = vehicles.filter((v) => v.grade_a_pct).length > 0
    ? vehicles.reduce((s, v) => s + (v.grade_a_pct ?? 0), 0) / vehicles.filter((v) => v.grade_a_pct).length
    : null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>🚜 รายงานคุณภาพรถบริการ</h3>

      {/* Summary top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { label: 'รถทั้งหมด', value: vehicles.length, unit: 'คัน', color: '#374151' },
          { label: 'งานเสร็จแล้ว', value: totalJobs, unit: 'ครั้ง', color: '#14532d' },
          { label: '% เกรด A เฉลี่ย', value: avgGradeAPct?.toFixed(0) ?? '—', unit: '%', color: '#1b5e20' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</p>
            <p style={{ margin: '1px 0 0', fontSize: 10, color: '#6b7280' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + Sort */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          style={{ flex: 1, minWidth: 120, padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#fff' }}>
          <option value="">ทุกประเภท</option>
          {Object.entries(VEHICLE_ICON).map(([v, icon]) => (
            <option key={v} value={v}>{icon} {v}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
          style={{ flex: 1, minWidth: 150, padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#fff' }}>
          <option value="score">เรียงตาม: คะแนนนิยม</option>
          <option value="quality">เรียงตาม: % เกรด A</option>
          <option value="rating">เรียงตาม: rating</option>
          <option value="jobs">เรียงตาม: จำนวนงาน</option>
        </select>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
        คะแนนนิยม = rating 40% + % เกรด A ข้าวโพด 40% + อัตราเสร็จงาน 20%
      </p>

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
          <p style={{ fontSize: 28, margin: '0 0 8px' }}>🚜</p>
          <p style={{ margin: 0, fontSize: 13 }}>ยังไม่มีข้อมูล — รัน migration และมีงานที่เสร็จแล้วก่อน</p>
        </div>
      )}

      {sorted.map((v) => (
        <VehicleRow
          key={v.vehicle_id}
          s={v}
          expanded={expanded === v.vehicle_id}
          onToggle={() => setExpanded(expanded === v.vehicle_id ? null : v.vehicle_id)}
        />
      ))}
    </div>
  );
}
