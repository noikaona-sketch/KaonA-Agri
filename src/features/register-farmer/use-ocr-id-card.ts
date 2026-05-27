'use client';

import { useState } from 'react';

export type OcrResult = {
  fullName: string;
  fullNameEn: string;
  bankAccountName: string;
  citizenId: string;
  dateOfBirth: string;
  address: string;
  houseNo: string;
  moo: string;
  subdistrict: string;
  district: string;
  province: string;
  confidence: number;
};

export type OcrDebugInfo = {
  rawText?: string;
  parsed?: OcrResult;
};

export type OcrStatus = 'idle' | 'scanning' | 'done' | 'failed';

export function useOcrIdCard() {
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<OcrDebugInfo | null>(null);

  function isThaiFullName(name: string) {
    return /^(?:นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|น\.ส\.)?\s*[ก-๙]+(?:\s+[ก-๙]+)+$/.test(name.trim());
  }

  async function scan(file: File) {
    setStatus('scanning');
    setError(null);
    setResult(null);
    setDebug(null);

    try {
      const form = new FormData();
      form.append('idImage', file);

      const debugEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ocrDebug') === '1';
      const endpoint = debugEnabled ? '/api/ocr/id-card?ocrDebug=1' : '/api/ocr/id-card';
      const res = await fetch(endpoint, { method: 'POST', body: form });
      const payload = (await res.json()) as {
        extracted?: OcrResult;
        confidence?: number;
        error?: string;
        debug?: OcrDebugInfo;
      };

      if (!res.ok || !payload.extracted) {
        setStatus('failed');
        setError('ระบบอ่านบัตรอัตโนมัติยังไม่พร้อมใช้งาน กรุณากรอกข้อมูลด้วยตนเอง');
        return null;
      }

      const ocr: OcrResult = {
        ...payload.extracted,
        fullName: isThaiFullName(payload.extracted.fullName ?? '') ? String(payload.extracted.fullName).trim() : '',
        confidence: payload.confidence ?? 0,
      };
      setResult(ocr);
      setDebug(payload.debug ?? null);
      setStatus('done');
      return ocr;
    } catch {
      setStatus('failed');
      setError('ระบบอ่านบัตรอัตโนมัติยังไม่พร้อมใช้งาน กรุณากรอกข้อมูลด้วยตนเอง');
      return null;
    }
  }

  function reset() {
    setStatus('idle');
    setResult(null);
    setError(null);
    setDebug(null);
  }

  return { status, result, error, debug, scan, reset };
}
