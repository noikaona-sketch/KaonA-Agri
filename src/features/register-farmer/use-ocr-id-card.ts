'use client';

import { useState } from 'react';

export type OcrResult = {
  fullName: string;
  citizenId: string;
  address: string;
  dateOfBirth: string;
  confidence: number;
};

export type OcrStatus = 'idle' | 'scanning' | 'done' | 'failed';

export function useOcrIdCard() {
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function scan(file: File) {
    setStatus('scanning');
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append('idImage', file);

      const res = await fetch('/api/ocr/id-card', { method: 'POST', body: form });
      const payload = (await res.json()) as {
        extracted?: OcrResult;
        confidence?: number;
        error?: string;
      };

      if (!res.ok || !payload.extracted) {
        setStatus('failed');
        setError(payload.error ?? 'อ่านบัตรไม่สำเร็จ กรุณากรอกเอง');
        return null;
      }

      const ocr: OcrResult = {
        ...payload.extracted,
        confidence: payload.confidence ?? 0,
      };
      setResult(ocr);
      setStatus('done');
      return ocr;
    } catch {
      setStatus('failed');
      setError('การเชื่อมต่อขัดข้อง กรุณากรอกเอง');
      return null;
    }
  }

  function reset() {
    setStatus('idle');
    setResult(null);
    setError(null);
  }

  return { status, result, error, scan, reset };
}
