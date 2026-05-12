'use client';

import { useRef } from 'react';

import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

import type { OcrResult, OcrStatus } from './use-ocr-id-card';

type OcrIdCardStepProps = {
  status: OcrStatus;
  result: OcrResult | null;
  error: string | null;
  onScan: (file: File) => void;
  onReset: () => void;
};

function maskId(id: string) {
  return id.length >= 4 ? `${'*'.repeat(id.length - 4)}${id.slice(-4)}` : id;
}

export function OcrIdCardStep({ status, result, error, onScan, onReset }: OcrIdCardStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onScan(file);
    e.target.value = '';
  }

  if (status === 'scanning') {
    return <LoadingState label="กำลังอ่านบัตรประชาชน…" />;
  }

  if (status === 'done' && result) {
    return (
      <div className="kaona-card" style={{ background: '#f1f8f1', borderColor: '#a5d6a7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>
            ✅ อ่านบัตรสำเร็จ ({result.confidence}%)
          </p>
          <button onClick={onReset} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            ถ่ายใหม่
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          ชื่อ: {result.fullName || '-'} · บัตร: {maskId(result.citizenId) || '-'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#ef6c00' }}>
          ⚠️ ตรวจสอบข้อมูลด้านล่างก่อนส่ง
        </p>
      </div>
    );
  }

  return (
    <div className="kaona-card" style={{ borderStyle: 'dashed' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>📷 สแกนบัตรประชาชน</p>
      <p style={{ margin: '4px 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}>
        ถ่ายรูปหรืออัปโหลดบัตรประชาชนเพื่อกรอกข้อมูลอัตโนมัติ
      </p>

      {error && (
        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--danger)' }}>⚠️ {error}</p>
      )}

      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <UIButton variant="secondary" onClick={() => inputRef.current?.click()}>
          📷 ถ่ายรูป
        </UIButton>
        <UIButton variant="ghost" onClick={() => {
          if (inputRef.current) { inputRef.current.removeAttribute('capture'); inputRef.current.click(); }
        }}>
          📁 เลือกไฟล์
        </UIButton>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
        หรือกรอกข้อมูลด้วยตนเองด้านล่าง
      </p>
    </div>
  );
}
