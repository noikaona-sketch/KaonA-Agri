'use client';

import { useMemo, useState } from 'react';
import { formatBytes, preprocessThaiIdCard } from '@/lib/image/compress';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { UIButton } from '@/shared/components/ui-button';

type OcrParsed = {
  fullName?: string;
  fullNameEn?: string;
  citizenId?: string;
  houseNo?: string;
  moo?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  address?: string;
  bankAccountName?: string;
};

type OcrResponse = {
  extracted?: OcrParsed;
  confidence?: number;
  error?: string;
  debug?: {
    rawText?: string;
    parsed?: OcrParsed;
  };
};

export default function AdminOcrTestPage() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [processedSize, setProcessedSize] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResponse | null>(null);
  const [cropApplied, setCropApplied] = useState<boolean | null>(null);
  const [processedDims, setProcessedDims] = useState<string | null>(null);
  const [cropConfidence, setCropConfidence] = useState<number | null>(null);

  const parsed = useMemo(() => ({ ...(result?.extracted ?? {}), confidence: result?.confidence ?? 0 }), [result]);

  async function handleFile(file: File) {
    setLoading(true);
    setResult(null);
    setWarning(null);
    const nextOriginalUrl = URL.createObjectURL(file);
    setOriginalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextOriginalUrl;
    });
    setOriginalSize(file.size);

    try {
      const pre = await preprocessThaiIdCard(file);
      setCropApplied(pre.cropApplied);
      setWarning(pre.warning);
      setProcessedSize(pre.blob.size);
      setProcessedDims(`${pre.width} × ${pre.height}`);
      setCropConfidence(pre.cropConfidence);

      const nextProcessedUrl = URL.createObjectURL(pre.blob);
      setProcessedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextProcessedUrl;
      });

      const out = new File([pre.blob], `${Date.now()}_id.jpg`, { type: 'image/jpeg' });
      const form = new FormData();
      form.append('idImage', out);

      const res = await fetch('/api/admin/ocr/id-card-debug', { method: 'POST', body: form, credentials: 'include' });
      const payload = (await res.json()) as OcrResponse;
      setResult(payload);
    } catch {
      setWarning('ใช้รูปเต็มแทน กรุณาตรวจสอบข้อมูลอีกครั้ง');
      setCropApplied(false);
      setProcessedSize(file.size);
      setProcessedDims(null);
      setCropConfidence(0);
      setProcessedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextOriginalUrl;
      });
      const form = new FormData();
      form.append('idImage', file);
      const res = await fetch('/api/admin/ocr/id-card-debug', { method: 'POST', body: form, credentials: 'include' });
      const payload = (await res.json()) as OcrResponse;
      setResult(payload);
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setResult(null);
    setWarning(null);
    setOriginalSize(null);
    setProcessedSize(null);
    setCropApplied(null);
    setProcessedDims(null);
    setCropConfidence(null);
    setOriginalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setProcessedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  async function copyResult() {
    const sizeWarning = (processedSize ?? 0) > 500 * 1024 ? `ไฟล์ยังเกิน 500KB (${formatBytes(processedSize ?? 0)})` : null;
    const text = JSON.stringify({
      cropApplied,
      cropConfidence,
      originalSizeBytes: originalSize ?? 0,
      processedSizeBytes: processedSize ?? 0,
      warning,
      sizeWarning,
      rawText: result?.debug?.rawText ?? '',
      parsed,
    }, null, 2);
    await navigator.clipboard.writeText(text);
  }

  return (
    <AdminWebShell title="🧪 OCR Test (บัตรประชาชนไทย)" subtitle="ทดสอบ OCR ก่อนใช้งานจริงใน flow สมัครสมาชิก">
      <div className="kaona-card" style={{ borderColor: '#f9a825', background: '#fff8e1', marginBottom: 12 }}>
        หน้านี้ใช้สำหรับทดสอบ OCR เท่านั้น ข้อมูลจะไม่ถูกบันทึก
      </div>

      <div className="kaona-card" style={{ marginBottom: 12 }}>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
          โหมด UAT รองรับทั้งกล้องและเลือกรูปจากแกลเลอรีโดยตั้งใจ เพื่อทดสอบเคสภาพจริงหลายรูปแบบ
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <UIButton variant="secondary" onClick={copyResult} disabled={!result}>คัดลอกผล OCR</UIButton>
          <UIButton variant="ghost" onClick={clearAll}>ล้างข้อมูล</UIButton>
        </div>

        {warning && <p style={{ margin: '10px 0 0', color: '#ef6c00', fontSize: 13 }}>⚠️ {warning}</p>}
        {processedSize !== null && processedSize > 500 * 1024 && (
          <p style={{ margin: '10px 0 0', color: 'var(--danger)', fontSize: 13 }}>⚠️ ไฟล์ยังเกิน 500KB ({formatBytes(processedSize)})</p>
        )}
        {loading && <p style={{ margin: '10px 0 0', fontSize: 13 }}>กำลังประมวลผล OCR...</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <div className="kaona-card">
          <p style={{ margin: 0, fontWeight: 700 }}>รูปต้นฉบับ</p>
          <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>ขนาดไฟล์: {originalSize ? formatBytes(originalSize) : '-'}</p>
          {originalUrl && <img src={originalUrl} alt="original" style={{ width: '100%', maxHeight: 220, objectFit: 'contain' }} />}
        </div>

        <div className="kaona-card">
          <p style={{ margin: 0, fontWeight: 700 }}>รูปหลัง crop/compress</p>
          <p style={{ margin: '4px 0 6px', fontSize: 12, color: cropApplied ? '#1b5e20' : '#ef6c00' }}>{cropApplied ? '✅ ตัดเฉพาะบัตรแล้ว' : '⚠️ ใช้รูปเต็ม (fallback)'}</p>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-secondary)' }}>cropConfidence: {cropConfidence !== null ? `${Math.round(cropConfidence * 100)}%` : '-'}</p>
          <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--text-secondary)' }}>ขนาดไฟล์: {processedSize ? formatBytes(processedSize) : '-'}{processedDims ? ` • ${processedDims}px` : ''}</p>
          {processedUrl && <img src={processedUrl} alt="processed" style={{ width: '100%', maxHeight: 220, objectFit: 'contain' }} />}
        </div>
      </div>

      <div className="kaona-card" style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Raw OCR text</p>
        <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12, background: '#f8fafc', padding: 8, borderRadius: 8 }}>{result?.debug?.rawText ?? '-'}</pre>
      </div>

      <div className="kaona-card" style={{ marginTop: 12 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Parsed fields</p>
        <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12, background: '#f8fafc', padding: 8, borderRadius: 8 }}>{JSON.stringify(parsed, null, 2)}</pre>
      </div>
    </AdminWebShell>
  );
}
