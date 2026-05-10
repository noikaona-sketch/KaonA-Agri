'use client';

import { useMemo, useState } from 'react';

import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { LoadingState } from '@/shared/components/loading-state';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { StatusChip } from '@/shared/components/status-chip';
import { StepList } from '@/shared/components/step-list';
import { UIButton } from '@/shared/components/ui-button';
import { PendingApprovalPanel } from '@/shared/pending-approval/pending-approval-panel';

type NoBurnFlowStep = 'join' | 'consent' | 'gps' | 'photos' | 'submit';
type RequestStatus = 'draft' | 'submitted' | 'under_review' | 'approved';
type ViewState = 'default' | 'loading' | 'error';

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

export function NoBurnParticipationWorkflow() {
  const [currentStep, setCurrentStep] = useState<NoBurnFlowStep>('join');
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [gpsAttached, setGpsAttached] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [viewState, setViewState] = useState<ViewState>('default');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const selectedCycle = useMemo(() => MOCK_CYCLES.find((cycle) => cycle.id === selectedCycleId) ?? null, [selectedCycleId]);

  const requestStatus: RequestStatus = submittedAt ? 'under_review' : 'draft';

  const checklist = [
    { title: '1) เข้าร่วมโครงการ', detail: selectedCycle ? `เลือกแล้ว: ${selectedCycle.label}` : 'เลือกรอบเพาะปลูกที่ต้องการเข้าร่วม', done: Boolean(selectedCycle) },
    { title: '2) ยินยอมเงื่อนไข', detail: consentAccepted ? 'ยืนยันความยินยอมแล้ว' : 'ยืนยันว่าจะไม่เผาและยอมให้ตรวจสอบ', done: consentAccepted },
    { title: '3) แนบพิกัด GPS', detail: gpsAttached ? 'บันทึกพิกัดจุดหลักฐานแล้ว' : 'แนบพิกัดจุดที่ทำกิจกรรมไม่เผา', done: gpsAttached },
    { title: '4) อัปโหลดรูปภาพ', detail: photoCount > 0 ? `แนบรูปแล้ว ${photoCount} รูป` : 'แนบรูปอย่างน้อย 1 รูป', done: photoCount > 0 },
    {
      title: '5) ส่งคำขอเพื่อตรวจสอบ',
      detail: submittedAt ? `ส่งคำขอเมื่อ ${submittedAt}` : 'หลังส่งคำขอ สถานะจะเป็นรอตรวจสอบ',
      done: Boolean(submittedAt),
    },
  ];

  function goNext() {
    if (currentStep === 'join' && selectedCycle) setCurrentStep('consent');
    else if (currentStep === 'consent' && consentAccepted) setCurrentStep('gps');
    else if (currentStep === 'gps' && gpsAttached) setCurrentStep('photos');
    else if (currentStep === 'photos' && photoCount > 0) setCurrentStep('submit');
  }

  function submitRequest() {
    if (!selectedCycle || !consentAccepted || !gpsAttached || photoCount === 0) return;
    setSubmittedAt(new Date().toLocaleString('th-TH'));
  }

  function resetFlow() {
    setCurrentStep('join');
    setSelectedCycleId('');
    setConsentAccepted(false);
    setGpsAttached(false);
    setPhotoCount(0);
    setSubmittedAt(null);
    setViewState('default');
  }

  const isNextDisabled =
    (currentStep === 'join' && !selectedCycle) ||
    (currentStep === 'consent' && !consentAccepted) ||
    (currentStep === 'gps' && !gpsAttached) ||
    (currentStep === 'photos' && photoCount === 0);

  return (
    <FormSheet
      title="เข้าร่วมโครงการไม่เผา (MVP)"
      footer={
        <div style={{ display: 'grid', gap: 8 }}>
          {submittedAt ? (
            <UIButton onClick={resetFlow} fullWidth>
              สร้างคำขอใหม่
            </UIButton>
          ) : currentStep === 'submit' ? (
            <UIButton onClick={submitRequest} fullWidth>
              ส่งคำขอ
            </UIButton>
          ) : (
            <UIButton onClick={goNext} disabled={isNextDisabled} fullWidth>
              ขั้นตอนถัดไป
            </UIButton>
          )}

          <label>
            สถานะหน้าจอ
            <select value={viewState} onChange={(event) => setViewState(event.target.value as ViewState)}>
              <option value="default">ปกติ</option>
              <option value="loading">กำลังโหลด</option>
              <option value="error">เกิดข้อผิดพลาด</option>
            </select>
          </label>
        </div>
      }
    >
      {viewState === 'loading' ? <LoadingState label="กำลังโหลดข้อมูลคำขอไม่เผา..." /> : null}
      {viewState === 'error' ? <ErrorState title="โหลดข้อมูลไม่สำเร็จ" detail="กรุณาลองใหม่อีกครั้ง หรือตรวจสอบสัญญาณอินเทอร์เน็ต" /> : null}

      <InfoCard
        title="คำขอเข้าร่วมโครงการไม่เผา"
        subtitle="LINE Mini App: เข้าร่วม → ยินยอม → GPS → รูปภาพ → ส่งคำขอ → รอตรวจสอบ"
        meta={<StatusChip status={requestStatus === 'draft' ? 'submitted' : requestStatus} />}
        action={<ProgressBadge current={checklist.filter((item) => item.done).length} total={checklist.length} />}
      />

      <StepList steps={checklist} />

      {currentStep === 'join' ? (
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

      {currentStep === 'consent' ? (
        <label>
          <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} /> ฉันยินยอมเข้าร่วมโครงการไม่เผา และอนุญาตให้ทีมภาคสนามตรวจสอบหลักฐาน
        </label>
      ) : null}

      {currentStep === 'gps' ? (
        <div>
          <p>แนบหลักฐานพิกัด GPS (MVP: จำลองการแนบพิกัดในแอป ไม่ติดตามเบื้องหลัง)</p>
          <UIButton type="button" onClick={() => setGpsAttached((value) => !value)}>
            {gpsAttached ? 'ลบพิกัด GPS (Mock)' : 'แนบพิกัด GPS (Mock)'}
          </UIButton>
        </div>
      ) : null}

      {currentStep === 'photos' ? (
        <div>
          <p>อัปโหลดรูปกิจกรรมไม่เผา (MVP: จำลองการอัปโหลด, ไม่ส่งไฟล์จริง)</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <UIButton type="button" onClick={() => setPhotoCount((value) => Math.min(5, value + 1))}>
              เพิ่มรูป (Mock)
            </UIButton>
            <UIButton type="button" variant="secondary" onClick={() => setPhotoCount((value) => Math.max(0, value - 1))}>
              ลบรูปล่าสุด
            </UIButton>
          </div>
          <p>จำนวนรูปที่แนบ: {photoCount} / 5</p>
        </div>
      ) : null}

      {currentStep === 'submit' ? (
        <>
          <p>ตรวจสอบข้อมูลก่อนส่งคำขอ</p>
          <p>• รอบเพาะปลูก: {selectedCycle?.label}</p>
          <p>• ยินยอม: {consentAccepted ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}</p>
          <p>• GPS: {gpsAttached ? 'แนบแล้ว' : 'ยังไม่แนบ'}</p>
          <p>• รูปหลักฐาน: {photoCount} รูป</p>
          {submittedAt ? (
            <>
              <p>ส่งคำขอสำเร็จเมื่อ {submittedAt}</p>
              <p>สถานะปัจจุบัน: รอตรวจสอบ (Pending verification)</p>
              <p>ติดตามสถานะ: ส่งคำขอแล้ว → รอตรวจสอบ → อนุมัติ/ไม่อนุมัติ</p>
            </>
          ) : null}
          <p>ส่งคำขอสำเร็จแล้ว สถานะปัจจุบัน: รอตรวจโดยทีมภาคสนาม</p>
          <p>Timeline: Submitted → Under review → Approved</p>
          <PendingApprovalPanel domain="no_burn_verification" status="under_review" />
        </>
      ) : null}
    </FormSheet>
  );
}
