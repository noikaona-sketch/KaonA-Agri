'use client';

type Props = {
  estimatedYieldKg: number;
  marketPricePerKg: number;
};

export function HarvestValuePreview({ estimatedYieldKg, marketPricePerKg }: Props) {
  if (estimatedYieldKg <= 0 || marketPricePerKg <= 0) return null;

  const estimatedValue = Math.round(estimatedYieldKg * marketPricePerKg);

  return (
    <div style={{
      background: '#fefce8', border: '1px solid #fde047',
      borderRadius: 8, padding: '10px 14px', marginBottom: 12,
    }}>
      <p style={{ margin: 0, fontSize: 13, color: '#713f12' }}>
        💰 ราคาประเมินเบื้องต้น:{' '}
        <strong>{estimatedValue.toLocaleString()} บาท</strong>
        <span style={{ fontWeight: 400, fontSize: 11, color: '#92400e' }}>
          {' '}({estimatedYieldKg.toLocaleString()} กก. × {marketPricePerKg} บาท/กก.)
        </span>
      </p>
      <p style={{ margin: '3px 0 0', fontSize: 11, color: '#92400e' }}>
        * คำนวณจากราคากลางปัจจุบัน ไม่รวมการปรับตามความชื้น
      </p>
    </div>
  );
}
