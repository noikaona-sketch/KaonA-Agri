'use client';

// NoBurnTimeline — แสดงสถานะ + timeline โบนัสต่อ request

type Props = {
  status          : string;
  submittedAt     : string;
  bonusType?      : string | null;
  bonusValue?     : number | null;
  bonusAmount?    : number | null;
  bonusLockedAt?  : string | null;
  reviewNote?     : string | null;
  plotAreaRai?    : number | null;
  seasonName?     : string | null;
};

type StepState = 'done' | 'active' | 'pending';

const STEPS: { key: string; label: string; icon: string; detail?: string }[] = [
  { key: 'submitted',           icon: '📤', label: 'ยื่นคำขอแล้ว' },
  { key: 'under_review',        icon: '🔍', label: 'กำลังตรวจสอบ',      detail: 'ทีมงานกำลังพิจารณา' },
  { key: 'inspection_required', icon: '📋', label: 'นัดตรวจแปลง',        detail: 'ภาคสนามจะติดต่อนัดหมาย' },
  { key: 'approved',            icon: '✅', label: 'อนุมัติแล้ว',        detail: 'ผ่านการตรวจสอบ' },
  { key: 'completed',           icon: '🏁', label: 'เสร็จสิ้น / โบนัส',  detail: 'โบนัสถูกบันทึกแล้ว' },
];

const STATUS_ORDER: Record<string, number> = {
  submitted: 0, under_review: 1, inspection_required: 2,
  approved: 3, completed: 4,
};

// สถานะ terminal ที่ไม่ใช่ approve
const REJECTED = new Set(['rejected', 'anomaly', 'cancelled']);

function stepState(stepIdx: number, currentStatus: string): StepState {
  if (REJECTED.has(currentStatus)) return stepIdx === 0 ? 'done' : 'pending';
  const cur = STATUS_ORDER[currentStatus] ?? 0;
  if (stepIdx < cur)  return 'done';
  if (stepIdx === cur) return 'active';
  return 'pending';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function NoBurnTimeline({
  status, submittedAt, bonusType, bonusValue, bonusAmount,
  bonusLockedAt, reviewNote, plotAreaRai, seasonName,
}: Props) {

  const isRejected = REJECTED.has(status);
  const isApproved = ['approved','completed'].includes(status);

  // คำนวณโบนัสประเมิน (ถ้ายังไม่มี bonusAmount)
  const estimatedBonus = bonusAmount
    ?? (bonusType === 'per_rai' && bonusValue && plotAreaRai
        ? bonusValue * plotAreaRai
        : null);

  return (
    <div style={{ display: 'grid', gap: 12 }}>

      {/* Bonus preview / result */}
      {bonusValue && !isRejected && (
        <div style={{
          background: isApproved ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${isApproved ? '#86efac' : '#fde68a'}`,
          borderRadius: 12, padding: '12px 14px',
          display: 'grid', gap: 6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: isApproved ? '#14532d' : '#92400e' }}>
              {isApproved ? '💰 โบนัสที่ได้รับ' : '💰 โบนัสที่จะได้รับ'}
            </p>
            {bonusLockedAt && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                🔒 ล็อคราคา {fmtDate(bonusLockedAt)}
              </span>
            )}
          </div>

          {/* Bonus amount */}
          {estimatedBonus != null ? (
            <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: isApproved ? '#14532d' : '#92400e' }}>
              +{estimatedBonus.toLocaleString()} บาท
              <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>
                ({bonusType === 'per_rai' ? `${bonusValue} × ${plotAreaRai} ไร่` : `${bonusValue} บาท/ตัน`})
              </span>
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#92400e' }}>
              +{bonusValue?.toLocaleString()} บาท/{bonusType === 'per_ton' ? 'ตัน' : 'ไร่'}
              {bonusType === 'per_ton' && (
                <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280', display: 'block', marginTop: 2 }}>
                  คำนวณอีกครั้งเมื่อชั่งน้ำหนักขายจริง
                </span>
              )}
            </p>
          )}

          {seasonName && (
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>รอบ: {seasonName}</p>
          )}
        </div>
      )}

      {/* Rejected notice */}
      {isRejected && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#dc2626' }}>⛔ ไม่ผ่านการพิจารณา</p>
          {reviewNote && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#374151' }}>{reviewNote}</p>}
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>
            ติดต่อเจ้าหน้าที่เพื่อสอบถามเพิ่มเติม หรือยื่นคำขอใหม่ในรอบถัดไป
          </p>
        </div>
      )}

      {/* Timeline steps */}
      <div style={{ position: 'relative', paddingLeft: 32 }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 13, top: 12, bottom: 12,
          width: 2, background: '#e5e7eb', borderRadius: 1,
        }} />

        <div style={{ display: 'grid', gap: 20 }}>
          {STEPS.map((step, i) => {
            const state  = stepState(i, status);
            const isDone = state === 'done';
            const isAct  = state === 'active';

            return (
              <div key={step.key} style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Dot */}
                <div style={{
                  position: 'absolute', left: -26,
                  width: 26, height: 26, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, zIndex: 1,
                  background: isDone ? '#2e7d32' : isAct ? '#fff' : '#f3f4f6',
                  border: `2px solid ${isDone ? '#2e7d32' : isAct ? '#2e7d32' : '#e5e7eb'}`,
                  color: isDone ? '#fff' : isAct ? '#2e7d32' : '#9ca3af',
                  boxShadow: isAct ? '0 0 0 4px #dcfce7' : 'none',
                }}>
                  {isDone ? '✓' : step.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, opacity: state === 'pending' ? 0.5 : 1 }}>
                  <p style={{ margin: 0, fontWeight: isAct ? 800 : 600, fontSize: 14,
                    color: isAct ? '#14532d' : isDone ? '#374151' : '#9ca3af' }}>
                    {step.label}
                    {isAct && (
                      <span style={{ marginLeft: 8, fontSize: 11, background: '#f0fdf4', color: '#14532d', padding: '2px 7px', borderRadius: 20, border: '1px solid #86efac', fontWeight: 700 }}>
                        ตอนนี้
                      </span>
                    )}
                  </p>
                  {step.key === 'submitted' && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                      {fmtDate(submittedAt)}
                    </p>
                  )}
                  {isAct && step.detail && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>{step.detail}</p>
                  )}
                  {/* Inspection instruction */}
                  {isAct && step.key === 'inspection_required' && (
                    <p style={{ margin: '6px 0 0', fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 10px', color: '#92400e', lineHeight: 1.6 }}>
                      📞 รอโทรศัพท์จากเจ้าหน้าที่ภาคสนาม<br />
                      เตรียมพร้อมพาไปดูแปลงได้เลยค่ะ
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
