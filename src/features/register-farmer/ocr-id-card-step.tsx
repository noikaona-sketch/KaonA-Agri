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

      {/* hidden inputs */}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

      {/* ปุ่มแบบธนาคาร */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button onClick={() => inputRef.current?.click()}
          style={{ border: '2px dashed #a5d6a7', borderRadius: 16, padding: '20px 12px', background: '#f1f8f1', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}>
          <span style={{ fontSize: 36 }}>📷</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>ถ่ายรูป</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>เปิดกล้อง</span>
        </button>
        <button onClick={() => {
          if (inputRef.current) {
            inputRef.current.removeAttribute('capture');
            inputRef.current.click();
            // restore capture after click
            setTimeout(() => inputRef.current?.setAttribute('capture', 'environment'), 500);
          }
        }}
          style={{ border: '2px dashed #90caf9', borderRadius: 16, padding: '20px 12px', background: '#e3f2fd', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}>
          <span style={{ fontSize: 36 }}>🖼️</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1565c0' }}>เลือกรูป</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>จากคลัง</span>
        </button>
      </div>

      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
        หรือกรอกข้อมูลด้วยตนเองด้านล่าง
      </p>
    </div>
  );
}
