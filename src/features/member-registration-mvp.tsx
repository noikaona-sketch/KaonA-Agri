'use client';

import { useMemo, useState } from 'react';

import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { LoadingState } from '@/shared/components/loading-state';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type MemberRegistrationMVPProps = {
  lineUserId: string;
  onSubmitted: () => Promise<void>;
};

type ScreenKey = 'register' | 'ocr' | 'review' | 'consent' | 'pending';
type DemoState = 'default' | 'empty' | 'loading' | 'error';

type DraftData = {
  fullName: string;
  phone: string;
  citizenId: string;
  citizenIdMasked: string;
  address: string;
};

const initialDraft: DraftData = {
  fullName: '',
  phone: '',
  citizenId: '',
  citizenIdMasked: '',
  address: '',
};

const screenTitle: Record<ScreenKey, string> = {
  register: 'สมัครสมาชิกเกษตรกร',
  ocr: 'สแกนบัตรประชาชน',
  review: 'ตรวจสอบ/แก้ไขข้อมูล',
  consent: 'ยินยอมการใช้ข้อมูล',
  pending: 'รอการอนุมัติ',
};

function maskCitizenId(value: string) {
  const digits = value.replace(/\D/g, '');

  if (!digits) return '';

  const visible = digits.slice(-4);
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${visible}`;
}

export function MemberRegistrationMVP({ lineUserId, onSubmitted }: MemberRegistrationMVPProps) {
  const [screen, setScreen] = useState<ScreenKey>('register');
  const [demoState, setDemoState] = useState<DemoState>('default');
  const [draft, setDraft] = useState<DraftData>(initialDraft);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'failed' | 'success'>('idle');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const flowSteps = useMemo(
    () => [
      { key: 'register', label: 'ลงทะเบียน' },
      { key: 'ocr', label: 'สแกนบัตร' },
      { key: 'review', label: 'ตรวจข้อมูล' },
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

  async function handleOcrUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setOcrStatus('processing');
    setOcrError(null);

    try {
      const form = new FormData();
      form.append('idImage', file);

      const response = await fetch('/api/ocr/id-card', {
        method: 'POST',
        body: form,
      });

      const payload = (await response.json()) as {
        error?: string;
        extracted?: { fullName?: string; citizenId?: string; address?: string };
      };

      if (!response.ok || !payload.extracted) {
        setOcrStatus('failed');
        setOcrError(payload.error ?? 'อ่านข้อมูลไม่สำเร็จ กรุณากรอกด้วยตนเอง');
        setScreen('review');
        return;
      }

      const citizenId = payload.extracted.citizenId ?? '';

      setDraft((prev) => ({
        ...prev,
        fullName: payload.extracted?.fullName ?? prev.fullName,
        citizenId,
        citizenIdMasked: maskCitizenId(citizenId),
        address: payload.extracted?.address ?? prev.address,
      }));
      setOcrStatus('success');
      setScreen('review');
    } catch {
      setOcrStatus('failed');
      setOcrError('การเชื่อมต่อ OCR มีปัญหา กรุณากรอกข้อมูลด้วยตนเอง');
      setScreen('review');
    }
  }

  async function submitPendingApproval() {
    setSubmitError(null);

    const response = await fetch('/api/member/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineUserId,
        fullName: draft.fullName,
        phone: draft.phone,
        citizenId: draft.citizenId,
        address: draft.address,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setSubmitError(payload.error ?? 'ส่งคำขอไม่สำเร็จ');
      return;
    }

    setScreen('pending');
    await onSubmitted();
  }

  return (
    <FormSheet
      title={screenTitle[screen]}
      footer={
        <div style={{ display: 'grid', gap: 8 }}>
          {screen !== 'pending' ? (
            <UIButton
              fullWidth
              onClick={async () => {
                if (screen === 'consent') {
                  await submitPendingApproval();
                  return;
                }

                goNext();
              }}
              disabled={screen === 'consent' && !consent}
            >
              {screen === 'consent' ? 'ส่งคำขออนุมัติ' : 'ถัดไป'}
            </UIButton>
          ) : (
            <UIButton fullWidth onClick={onSubmitted}>รีเฟรชสถานะ</UIButton>
          )}
          <UIButton variant="secondary" fullWidth onClick={() => setScreen('register')}>
            เริ่มใหม่
          </UIButton>
        </div>
      }
    >
      <p style={{ marginTop: 0 }}>LINE UID: {lineUserId.slice(0, 8)}...</p>

      <label>
        โหมดแสดงผล UI
        <select value={demoState} onChange={(event) => setDemoState(event.target.value as DemoState)}>
          <option value="default">ปกติ</option>
          <option value="empty">empty state</option>
          <option value="loading">loading state</option>
          <option value="error">error state</option>
        </select>
      </label>

      {demoState === 'empty' ? <EmptyState title="ยังไม่มีข้อมูลลงทะเบียน" detail="กรอกข้อมูลผู้สมัครเพื่อเริ่มต้นกระบวนการ" /> : null}
      {demoState === 'loading' ? <LoadingState label="กำลังโหลดหน้าลงทะเบียน..." /> : null}
      {demoState === 'error' ? <ErrorState title="เกิดข้อผิดพลาดชั่วคราว" detail="ไม่สามารถโหลดข้อมูลตัวอย่างได้ กรุณาลองใหม่" /> : null}

      {screen === 'register' ? (
        <>
          <p>กรอกข้อมูลเบื้องต้นเพื่อสมัครสมาชิกผ่าน LINE Mini App</p>
          <label>
            เบอร์โทร
            <input value={draft.phone} onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))} />
          </label>
        </>
      ) : null}

      {screen === 'ocr' ? (
        <>
          <p>อัปโหลด/ถ่ายรูปบัตรประชาชนเพื่ออ่านข้อมูลอัตโนมัติ (ประมวลผลฝั่งเซิร์ฟเวอร์)</p>
          <input type="file" accept="image/*" capture="environment" onChange={handleOcrUpload} />
          {ocrStatus === 'processing' ? <LoadingState label="กำลังอ่านข้อมูลจากบัตร..." /> : null}
          {ocrStatus === 'failed' ? <ErrorState title="OCR ไม่สำเร็จ" detail={ocrError ?? 'กรุณากรอกข้อมูลเอง'} /> : null}
          <p style={{ marginBottom: 0 }}>หาก OCR ไม่สำเร็จ สามารถกรอกข้อมูลด้วยตนเองในขั้นตอนถัดไปได้ทันที</p>
        </>
      ) : null}

      {screen === 'review' ? (
        <>
          <h3 style={{ marginBottom: 6 }}>ตรวจสอบ/แก้ไขข้อมูล</h3>
          {ocrStatus === 'failed' ? <StatusChip status="under_review" /> : null}
          <label>
            ชื่อ-นามสกุล
            <input value={draft.fullName} onChange={(event) => setDraft((prev) => ({ ...prev, fullName: event.target.value }))} />
          </label>
          <label>
            เลขบัตรประชาชน
            <input
              value={draft.citizenId}
              onChange={(event) => {
                const citizenId = event.target.value;
                setDraft((prev) => ({ ...prev, citizenId, citizenIdMasked: maskCitizenId(citizenId) }));
              }}
            />
          </label>
          <p>แสดงผลแบบปกปิด: {draft.citizenIdMasked || '-'}</p>
          <label>
            ที่อยู่ตามบัตรประชาชน
            <textarea value={draft.address} onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))} rows={3} />
          </label>
        </>
      ) : null}

      {screen === 'consent' ? (
        <>
          <p>ข้าพเจ้ายินยอมให้ระบบใช้ข้อมูลเพื่อการยืนยันตัวตนและการพิจารณาสมัครสมาชิก</p>
          <label>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> ยืนยันความยินยอม
          </label>
          {submitError ? <ErrorState title="ส่งคำขอไม่สำเร็จ" detail={submitError} /> : null}
        </>
      ) : null}

      {screen === 'pending' ? <InfoMockCard title="คำขอถูกส่งแล้ว" detail="สถานะ: รอเจ้าหน้าที่ตรวจสอบและอนุมัติ" /> : null}
    </FormSheet>
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
