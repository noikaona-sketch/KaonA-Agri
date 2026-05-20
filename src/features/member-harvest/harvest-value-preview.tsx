'use client';

type Props = {
  estimatedYieldKg: number;
  marketPricePerKg: number;
  estimatedMoisturePct?: number;
};

export function HarvestValuePreview({ estimatedYieldKg, marketPricePerKg, estimatedMoisturePct }: Props) {
  if (estimatedYieldKg <= 0 || marketPricePerKg <= 0) return null;

  const estimatedValue = Math.round(estimatedYieldKg * marketPricePerKg);
  const referenceMoisturePct = 28;
  const canShowMoistureEstimate = typeof estimatedMoisturePct === 'number' && estimatedMoisturePct > referenceMoisturePct && estimatedMoisturePct < 100;
  const adjustedWeightKg = canShowMoistureEstimate
    ? Math.round((estimatedYieldKg * (100 - estimatedMoisturePct)) / (100 - referenceMoisturePct))
    : null;
  const adjustedValueBaht = adjustedWeightKg ? Math.round(adjustedWeightKg * marketPricePerKg) : null;
  const valueDiffBaht = adjustedValueBaht !== null ? adjustedValueBaht - estimatedValue : null;

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
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#92400e' }}>
        * เครื่องคำนวณด้านล่างเป็นเพียงค่าประมาณเพื่อเปรียบเทียบเบื้องต้น
      </p>

      <div style={{
        marginTop: 10,
        borderTop: '1px dashed #facc15',
        paddingTop: 8,
        fontSize: 12,
        color: '#713f12',
      }}>
        <p style={{ margin: 0, fontWeight: 700 }}>
          🧮 เปรียบเทียบผลกระทบความชื้น (ตัวอย่าง {referenceMoisturePct}%)
        </p>
        <p style={{ margin: '3px 0 0' }}>
          กรณีตัวอย่าง: ความชื้น 32% → 28% จะเห็นน้ำหนักและมูลค่าลดลงตามสัดส่วนของน้ำ
        </p>
        {canShowMoistureEstimate && adjustedWeightKg !== null && adjustedValueBaht !== null && valueDiffBaht !== null ? (
          <p style={{ margin: '4px 0 0' }}>
            จาก <strong>{estimatedMoisturePct}%</strong> ไป <strong>{referenceMoisturePct}%</strong>:
            น้ำหนักเทียบเท่า ~ <strong>{adjustedWeightKg.toLocaleString()} กก.</strong>
            {' '}และมูลค่าประมาณ ~ <strong>{adjustedValueBaht.toLocaleString()} บาท</strong>
            {' '}(<strong>{valueDiffBaht.toLocaleString()} บาท</strong> เทียบกับน้ำหนักเดิม)
          </p>
        ) : (
          <p style={{ margin: '4px 0 0' }}>
            ระบุความชื้นมากกว่า {referenceMoisturePct}% เพื่อดูการเปรียบเทียบกับน้ำหนักที่ความชื้น {referenceMoisturePct}%.
          </p>
        )}
      </div>
    </div>
  );
}
