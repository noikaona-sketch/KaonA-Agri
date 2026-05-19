'use client';

type SummaryProps = {
  pendingCount:    number;
  confirmedCount:  number;
  dryerLoad:       number;
  estimatedTonnage: number;
};

export function HarvestQueueSummary({
  pendingCount, confirmedCount, dryerLoad, estimatedTonnage,
}: SummaryProps) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'คิวรออยู่',  value: pendingCount,   color: '#e65100' },
          { label: 'ยืนยันแล้ว', value: confirmedCount,  color: '#2e7d32' },
          { label: 'ต้องการอบ',  value: dryerLoad,       color: '#b45309' },
        ].map((s) => (
          <div key={s.label} style={{
            background: '#f9fafb', borderRadius: 10,
            padding: '10px 12px', border: `1px solid ${s.color}33`,
          }}>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
            <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 22, color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
      {estimatedTonnage > 0 && (
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#374151' }}>
          📦 ปริมาณคาดการณ์รวม:{' '}
          <strong>{estimatedTonnage.toLocaleString()} กก.</strong>
          {' '}({(estimatedTonnage / 1000).toFixed(1)} ตัน)
        </p>
      )}
    </>
  );
}
