'use client';

// ─────────────────────────────────────────────────────────────────────────────
// HarvestDataQualityBadge — P2 PR8
// Read-only warning badges for incomplete/suspicious harvest booking data.
// No auto-fix. No migration. Admin awareness only.
// ─────────────────────────────────────────────────────────────────────────────

type QualityProps = {
  status:            string;
  actualReceivedKg:  number | null;
  actualMoisturePct: number | null;
  actualCompletedAt: string | null;
};

type Warning = { label: string; color: string; bg: string };

export function getDataWarnings({
  status, actualReceivedKg, actualMoisturePct, actualCompletedAt,
}: QualityProps): Warning[] {
  if (status !== 'completed') return [];
  const w: Warning[] = [];
  if (actualReceivedKg == null)
    w.push({ label: '⚠️ ไม่มีน้ำหนักจริง',  color: '#b45309', bg: '#fef9c3' });
  if (actualMoisturePct == null)
    w.push({ label: '⚠️ ไม่มีความชื้นจริง', color: '#b45309', bg: '#fef9c3' });
  if (actualCompletedAt == null)
    w.push({ label: '⚠️ ไม่มีวันที่เสร็จ',   color: '#6b7280', bg: '#f3f4f6' });
  if (actualMoisturePct != null && (actualMoisturePct < 8 || actualMoisturePct > 45))
    w.push({ label: `⚠️ ความชื้น ${actualMoisturePct}% ผิดปกติ`, color: '#c62828', bg: '#ffebee' });
  return w;
}

export function HarvestDataQualityBadge(props: QualityProps) {
  const warnings = getDataWarnings(props);
  if (warnings.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {warnings.map((w) => (
        <span key={w.label} style={{
          fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
          background: w.bg, color: w.color, border: `1px solid ${w.color}33`,
          whiteSpace: 'nowrap',
        }}>
          {w.label}
        </span>
      ))}
    </div>
  );
}

// ── Reusable empty state ──────────────────────────────────────────────────────
export function HarvestEmptyState({ message = 'ยังไม่มีข้อมูล' }: { message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>
      <p style={{ fontSize: 32, margin: '0 0 8px' }}>🌾</p>
      <p style={{ fontSize: 14, margin: 0 }}>{message}</p>
    </div>
  );
}
