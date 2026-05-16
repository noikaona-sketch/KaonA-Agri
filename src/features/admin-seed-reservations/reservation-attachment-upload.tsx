'use client';
// Upload attachment for reservation (compress image, upload PDF as-is)

import { useRef, useState } from 'react';
import { compressAndUpload, type UploadResult } from '@/shared/utils/compress-and-upload';

type Props = {
  reservationNo: string;
  value: UploadResult | null;
  onChange: (result: UploadResult | null) => void;
};

export function ReservationAttachmentUpload({ reservationNo, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (!allowed.includes(file.type)) {
      setError('รองรับเฉพาะ JPG, PNG, WebP, PDF เท่านั้น'); return;
    }
    setUploading(true); setError(null);
    try {
      const result = await compressAndUpload(file, reservationNo);
      onChange(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>ไฟล์แนบ (หลักฐานการจอง)</p>

      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#e8f5e9', borderRadius: 8, padding: '8px 12px' }}>
          <a href={value.url} target="_blank" rel="noreferrer"
            style={{ flex: 1, fontSize: 13, color: '#1565c0', fontWeight: 600, wordBreak: 'break-all' }}>
            {value.path.split('/').pop()}
          </a>
          <button onClick={() => { onChange(null); }} style={{ border: 'none', background: 'none', color: '#c62828', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          style={{ border: '2px dashed #a5d6a7', borderRadius: 10, padding: '16px', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', background: '#f1f8f1' }}>
          {uploading
            ? <p style={{ margin: 0, fontSize: 13, color: '#1b5e20' }}>กำลังบีบอัดและอัปโหลด…</p>
            : <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>📎 คลิกเพื่อแนบรูปหรือ PDF</p>}
        </div>
      )}

      {error && <p style={{ margin: 0, fontSize: 12, color: '#c62828' }}>⚠️ {error}</p>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}
