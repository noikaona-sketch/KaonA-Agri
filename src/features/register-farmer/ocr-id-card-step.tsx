'use client';

import { useRef, useState } from 'react';
import { compressIdCard, formatBytes } from '@/lib/image/compress';

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
  const inputRef   = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCompressing(true);
    try {
      setPreviewUrl(URL.createObjectURL(file));
      const compressed = await compressIdCard(file);
      const out = new File([compressed], file.name.replace(/\.[^.]+$/, '') + '_id.jpg', { type: 'image/jpeg' });
      console.log(`[ID-OCR] ${formatBytes(file.size)} → ${formatBytes(compressed.size)}`);
      onScan(out);
    } catch { onScan(file); }
    setCompressing(false);
  }

  if (compressing) return <LoadingState label="กำลังบีบอัดและตัดขอบภาพ…" />;
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

      {previewUrl && (
        <div style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', background: '#f8fafc', border: '1px solid var(--border)' }}>
          <img src={previewUrl} alt="ตัวอย่างบัตร" style={{ width: '100%', maxHeight: 140, objectFit: 'contain', display: 'block' }} />
        </div>
      )}

      {/* hidden inputs */}
      <input ref={inputRef}        type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <button onClick={() => inputRef.current?.click()}
          style={{ border: '2px dashed #a5d6a7', borderRadius: 16, padding: '20px 12px', background: '#f1f8f1', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 36 }}>📷</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>ถ่ายรูป</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>เปิดกล้องหลัง</span>
        </button>
      </div>

      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
        หรือกรอกข้อมูลด้วยตนเองด้านล่าง
      </p>
    </div>
  );
}
