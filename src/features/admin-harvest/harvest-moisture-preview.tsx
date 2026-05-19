'use client';

// ─────────────────────────────────────────────────────────────────────────────
// HarvestMoisturePreview — P2 PR6 (revised scope)
//
// Read-only variance display after harvest completion.
// Shows expected vs actual for moisture and weight only.
// No pricing. No economics. No market_prices dependency.
// ─────────────────────────────────────────────────────────────────────────────

function VarianceRow({
  label, estimated, actual, unit, invertColor,
}: {
  label:        string;
  estimated:    number | null;
  actual:       number | null;
  unit:         string;
  invertColor?: boolean; // true = lower actual is better (e.g. moisture)
}) {
  if (actual == null) return null;
  const diff    = estimated != null ? actual - estimated : null;
  const pct     = estimated != null && estimated !== 0
    ? ((diff! / estimated) * 100).toFixed(1)
    : null;
  const positive = diff != null && diff >= 0;
  // For moisture: higher is worse → invert color
  const good = invertColor ? !positive : positive;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '10px 0', borderBottom: '1px solid #f3f4f6',
    }}>
      <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{label}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13 }}>
          {estimated != null && (
            <span style={{ color: '#9ca3af' }}>
              ประมาณการ {estimated.toLocaleString()} {unit} →{' '}
            </span>
          )}
          <strong>จริง {actual.toLocaleString()} {unit}</strong>
        </div>
        {diff != null && (
          <span style={{
            fontSize: 12, fontWeight: 700, marginLeft: 8, whiteSpace: 'nowrap',
            color: good ? '#2e7d32' : '#c62828',
          }}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(diff % 1 === 0 ? 0 : 1)} {unit}
            {pct ? ` (${diff >= 0 ? '+' : ''}${pct}%)` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function MoistureGuidance({ actualMoisture, estimatedMoisture }: {
  actualMoisture: number; estimatedMoisture: number | null;
}) {
  const diff = estimatedMoisture != null
    ? actualMoisture - estimatedMoisture
    : null;

  const lines: string[] = [];

  if (diff != null && diff > 2) {
    lines.push(`ความชื้นสูงกว่าค่าประมาณ ${diff.toFixed(1)}%`);
    lines.push('อาจรอให้แห้งในแปลงอีก 2–3 วัน หากสภาพอากาศเหมาะสม');
  } else if (diff != null && diff > 0) {
    lines.push(`ความชื้นสูงกว่าค่าประมาณเล็กน้อย ${diff.toFixed(1)}%`);
  } else if (diff != null && diff < 0) {
    lines.push(`ความชื้นต่ำกว่าค่าประมาณ ${Math.abs(diff).toFixed(1)}%`);
  }
  lines.push('ให้โรงงานยืนยันเงื่อนไขรับซื้อจริง');

  return (
    <div style={{
      background: '#f9fafb', borderRadius: 8,
      padding: '10px 12px', marginTop: 10,
    }}>
      {lines.map((l, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : '4px 0 0', fontSize: 12, color: '#374151' }}>
          {l}
        </p>
      ))}
    </div>
  );
}

type Props = {
  farmerEstKg:        number | null;
  farmerEstMoisture:  number | null;
  actualReceivedKg:   number | null;
  actualMoisturePct:  number | null;
};

export function HarvestMoisturePreview({
  farmerEstKg, farmerEstMoisture,
  actualReceivedKg, actualMoisturePct,
}: Props) {
  if (!actualReceivedKg && !actualMoisturePct) return null;

  return (
    <div style={{
      background: '#fafafa', borderRadius: 12,
      border: '1px solid #e5e7eb', overflow: 'hidden',
    }}>
      <div style={{ background: '#374151', padding: '10px 14px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#fff' }}>
          📊 ผลการเก็บเกี่ยวเทียบประมาณการ
        </p>
      </div>
      <div style={{ padding: '4px 14px 12px' }}>
        <VarianceRow
          label="น้ำหนักรับ (กก.)"
          estimated={farmerEstKg}
          actual={actualReceivedKg}
          unit="กก."
        />
        <VarianceRow
          label="ความชื้น (%)"
          estimated={farmerEstMoisture}
          actual={actualMoisturePct}
          unit="%"
          invertColor
        />
        {actualMoisturePct != null && (
          <MoistureGuidance
            actualMoisture={actualMoisturePct}
            estimatedMoisture={farmerEstMoisture}
          />
        )}
      </div>
    </div>
  );
}
