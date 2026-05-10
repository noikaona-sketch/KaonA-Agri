'use client';

import { useMemo, useState } from 'react';

import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { LoadingState } from '@/shared/components/loading-state';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';
import { PendingApprovalPanel } from '@/shared/pending-approval/pending-approval-panel';

type MemberRegistrationMVPProps = {
  lineUserId: string;
  onSubmitted: () => Promise<void>;
};

type ScreenKey = 'register' | 'ocr-placeholder' | 'review' | 'correct' | 'consent' | 'pending';
type DemoState = 'default' | 'empty' | 'loading' | 'ocr-processing' | 'success' | 'error' | 'pending';

type DraftData = {
  fullName: string;
  phone: string;
  citizenIdMasked: string;
  address: string;
};

const initialDraft: DraftData = {
  fullName: 'นายสมชาย ใจดี',
  phone: '08x-xxx-1234',
  citizenIdMasked: '1-2345-67xxx-xx-1',
  address: 'อำเภอเชียงคำ จังหวัดพะเยา',
};

const screenTitle: Record<ScreenKey, string> = {
  register: 'สมัครสมาชิกเกษตรกร',
  'ocr-placeholder': 'สแกนบัตรประชาชน (ตัวอย่าง)',
  review: 'ตรวจสอบข้อมูลที่อ่านได้',
  correct: 'แก้ไขข้อมูลก่อนส่ง',
  consent: 'ยินยอมการใช้ข้อมูล',
  pending: 'รอการอนุมัติ',
};

export function MemberRegistrationMVP({ lineUserId, onSubmitted }: MemberRegistrationMVPProps) {
  const [screen, setScreen] = useState<ScreenKey>('register');
  const [demoState, setDemoState] = useState<DemoState>('default');
  const [draft, setDraft] = useState<DraftData>(initialDraft);

  const flowSteps = useMemo(
    () => [
      { key: 'register', label: 'ลงทะเบียน' },
      { key: 'ocr-placeholder', label: 'OCR ตัวอย่าง' },
      { key: 'review', label: 'ตรวจข้อมูล' },
      { key: 'correct', label: 'แก้ไข' },
      { key: 'consent', label: 'ยินยอม' },
      { key: 'pending', label: 'รออนุมัติ' },
    ],
    [],
  );

  function goNext() {
    const index = flowSteps.findIndex((step) => step.key === screen);
    const next = flowSteps[index + 1];
    if (next) setScreen(next.key as ScreenKey);
  }

  return (
    <FormSheet
      title={screenTitle[screen]}
      footer={
        <div style={{ display: 'grid', gap: 8 }}>
          {screen !== 'pending' ? (
            <UIButton fullWidth onClick={goNext}>
              ถัดไป
            </UIButton>
          ) : (
            <UIButton
              fullWidth
              onClick={async () => {
                setDemoState('pending');
                await onSubmitted();
              }}
            >
              รีเฟรชสถานะ
            </UIButton>
          )}
          <UIButton variant="secondary" fullWidth onClick={() => setScreen('register')}>
            เริ่มใหม่
          </UIButton>
        </div>
      }
    >
      <p style={{ marginTop: 0 }}>LINE UID: {lineUserId.slice(0, 8)}... (เฉพาะหน้าจอจำลอง UX)</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {flowSteps.map((step) => (
          <UIButton key={step.key} variant={screen === step.key ? 'primary' : 'ghost'} onClick={() => setScreen(step.key as ScreenKey)}>
            {step.label}
          </UIButton>
        ))}
      </div>

      <label>
        โหมดแสดงผล UI
        <select value={demoState} onChange={(event) => setDemoState(event.target.value as DemoState)}>
          <option value="default">ปกติ</option>
          <option value="empty">empty state</option>
          <option value="loading">loading state</option>
          <option value="ocr-processing">OCR processing placeholder</option>
          <option value="success">success state</option>
          <option value="error">error state</option>
          <option value="pending">pending approval state</option>
        </select>
      </label>

      {demoState === 'empty' ? <EmptyState title="ยังไม่มีข้อมูลลงทะเบียน" detail="กรอกข้อมูลผู้สมัครเพื่อเริ่มต้นกระบวนการ" /> : null}
      {demoState === 'loading' ? <LoadingState label="กำลังโหลดหน้าลงทะเบียน..." /> : null}
      {demoState === 'error' ? <ErrorState title="เกิดข้อผิดพลาดชั่วคราว" detail="ไม่สามารถโหลดข้อมูลตัวอย่างได้ กรุณาลองใหม่" /> : null}
      {demoState === 'success' ? <StatusChip status="approved" /> : null}
      {demoState === 'pending' ? <StatusChip status="submitted" /> : null}

      {screen === 'register' ? (
        <>
          <p>กรอกข้อมูลเบื้องต้นเพื่อสมัครสมาชิกผ่าน LINE Mini App (หน้าจอจำลอง ไม่บันทึกข้อมูลจริง)</p>
          <label>
            ชื่อ-นามสกุล
            <input value={draft.fullName} onChange={(event) => setDraft((prev) => ({ ...prev, fullName: event.target.value }))} />
          </label>
          <label>
            เบอร์โทร
            <input value={draft.phone} onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))} />
          </label>
        </>
      ) : null}

      {screen === 'ocr-placeholder' || demoState === 'ocr-processing' ? (
        <InfoMockCard title="OCR Placeholder" detail="จำลองการประมวลผลเอกสาร 2-4 วินาที (ไม่มีการเชื่อมต่อผู้ให้บริการ OCR จริง)" />
      ) : null}

      {screen === 'review' ? <ReviewCard draft={draft} /> : null}

      {screen === 'correct' ? (
        <label>
          ที่อยู่ตามบัตรประชาชน
          <textarea value={draft.address} onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))} rows={3} />
        </label>
      ) : null}

      {screen === 'consent' ? (
        <InfoMockCard
          title="ความยินยอม"
          detail="ข้าพเจ้ายินยอมให้ระบบใช้ข้อมูลเพื่อการยืนยันตัวตนและการพิจารณาสมัครสมาชิก โดยข้อมูลนี้เป็นตัวอย่าง UI เท่านั้น"
        />
      ) : null}

      {screen === 'pending' ? <PendingApprovalPanel domain="member_onboarding" status="under_review" /> : null}
    </FormSheet>
  );
}

function ReviewCard({ draft }: { draft: DraftData }) {
  return (
    <article>
      <h3 style={{ marginBottom: 6 }}>ข้อมูลที่สแกนได้ (ตัวอย่าง)</h3>
      <p>ชื่อ: {draft.fullName}</p>
      <p>โทรศัพท์: {draft.phone}</p>
      <p>เลขบัตร (ปกปิด): {draft.citizenIdMasked}</p>
      <p>ที่อยู่: {draft.address}</p>
    </article>
  );
}

function InfoMockCard({ title, detail }: { title: string; detail: string }) {
  return (
    <article style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 12 }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p style={{ marginBottom: 0 }}>{detail}</p>
    </article>
  );
}
