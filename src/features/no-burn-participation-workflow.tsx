'use client';

import { useMemo, useState } from 'react';

import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { StatusChip } from '@/shared/components/status-chip';
import { StepList } from '@/shared/components/step-list';
import { UIButton } from '@/shared/components/ui-button';

type NoBurnFlowStep = 'select_cycle' | 'agreement' | 'evidence' | 'review';
type RequestStatus = 'draft' | 'submitted' | 'under_review' | 'approved';

type PlantingCycleOption = {
  id: string;
  label: string;
  phase: string;
};

const MOCK_CYCLES: PlantingCycleOption[] = [
  { id: '2026-rice-1', label: 'ข้าวนาปี 2026 แปลง A', phase: 'กำลังเพาะปลูก' },
  { id: '2026-corn-1', label: 'ข้าวโพดเลี้ยงสัตว์ 2026 แปลง B', phase: 'เตรียมดิน' },
  { id: '2025-rice-3', label: 'ข้าวนาปรัง 2025 แปลง C', phase: 'ปิดรอบและรอตรวจซ้ำ' },
];

function flowToStatus(step: NoBurnFlowStep): RequestStatus {
  if (step === 'review') return 'under_review';
  if (step === 'evidence') return 'submitted';
  return 'draft';
}

export function NoBurnParticipationWorkflow() {
  const [currentStep, setCurrentStep] = useState<NoBurnFlowStep>('select_cycle');
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [evidenceAttached, setEvidenceAttached] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const selectedCycle = useMemo(() => MOCK_CYCLES.find((cycle) => cycle.id === selectedCycleId) ?? null, [selectedCycleId]);
  const requestStatus = flowToStatus(currentStep);

  const checklist = [
    { title: 'เลือกแปลงเพาะปลูก', detail: selectedCycle ? `เลือกแล้ว: ${selectedCycle.label}` : 'เลือกแปลงที่ต้องการเข้าร่วมไม่เผา', done: Boolean(selectedCycle) },
    { title: 'ยืนยันข้อตกลงไม่เผา', detail: agreementAccepted ? 'ยืนยันข้อตกลงเรียบร้อย' : 'ยอมรับเงื่อนไขก่อนส่งคำขอ', done: agreementAccepted },
    { title: 'แนบหลักฐานภาพกิจกรรม', detail: evidenceAttached ? 'แนบรูปหลักฐานแล้ว (UI mock)' : 'แนบรูปกิจกรรมลดการเผาในแปลง', done: evidenceAttached },
    { title: 'รอตรวจโดยทีมภาคสนาม', detail: submittedAt ? `ส่งคำขอเมื่อ ${submittedAt}` : 'เมื่อส่งคำขอแล้วสถานะจะเปลี่ยนเป็นรอตรวจ', done: Boolean(submittedAt) },
  ];

  function goNext() {
    if (currentStep === 'select_cycle' && selectedCycle) setCurrentStep('agreement');
    else if (currentStep === 'agreement' && agreementAccepted) setCurrentStep('evidence');
    else if (currentStep === 'evidence' && evidenceAttached) {
      setCurrentStep('review');
      setSubmittedAt(new Date().toLocaleString());
    }
  }

  function resetFlow() {
    setCurrentStep('select_cycle');
    setSelectedCycleId('');
    setAgreementAccepted(false);
    setEvidenceAttached(false);
    setSubmittedAt(null);
  }

  return (
    <FormSheet
      title="No-burn participation"
      footer={
        currentStep === 'review' ? (
          <UIButton onClick={resetFlow} fullWidth>
            สร้างคำขอใหม่
          </UIButton>
        ) : (
          <UIButton
            onClick={goNext}
            disabled={
              (currentStep === 'select_cycle' && !selectedCycle) ||
              (currentStep === 'agreement' && !agreementAccepted) ||
              (currentStep === 'evidence' && !evidenceAttached)
            }
            fullWidth
          >
            ขั้นตอนถัดไป
          </UIButton>
        )
      }
    >
      <InfoCard
        title="คำขอเข้าร่วมโครงการไม่เผา"
        subtitle="ต้นแบบ UX flow สำหรับสมาชิก (UI only)"
        meta={<StatusChip status={requestStatus === 'draft' ? 'submitted' : requestStatus} />}
        action={<ProgressBadge current={checklist.filter((item) => item.done).length} total={checklist.length} />}
      />

      <StepList steps={checklist} />

      {currentStep === 'select_cycle' ? (
        <label>
          รอบเพาะปลูก
          <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)}>
            <option value="">เลือกรอบเพาะปลูก</option>
            {MOCK_CYCLES.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.label} ({cycle.phase})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {currentStep === 'agreement' ? (
        <label>
          <input type="checkbox" checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} /> ฉันยืนยันว่าจะไม่เผาเศษวัสดุในแปลง และยินยอมให้ทีมภาคสนามเข้าตรวจ
        </label>
      ) : null}

      {currentStep === 'evidence' ? (
        <div>
          <p>แนบหลักฐานรูปภาพกิจกรรม (ต้นแบบ UI ไม่อัปโหลดไฟล์จริง)</p>
          <UIButton type="button" onClick={() => setEvidenceAttached((value) => !value)}>
            {evidenceAttached ? 'ลบหลักฐาน (Mock)' : 'แนบหลักฐาน (Mock)'}
          </UIButton>
        </div>
      ) : null}

      {currentStep === 'review' ? (
        <>
          <p>ส่งคำขอสำเร็จแล้ว สถานะปัจจุบัน: รอตรวจโดยทีมภาคสนาม</p>
          <p>Timeline: Submitted → Under review → Approved</p>
        </>
      ) : null}
    </FormSheet>
  );
}
