'use client';

import { useState } from 'react';

import { ensureLiffIdToken } from '@/lib/liff/init-liff';
import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

import { OcrIdCardStep } from './ocr-id-card-step';
import { PlotItem, newPlotDraft } from './plot-item';
import type { PlotDraft } from './plot-item';
import { useOcrIdCard } from './use-ocr-id-card';

type FarmerWizardProps = {
  lineUserId: string;
  onSubmitted: () => void;
};

type Step = 'personal' | 'plots' | 'review';

function maskId(v: string) {
  const d = v.replace(/\D/g, '');
  return d.length > 4 ? `${'*'.repeat(d.length - 4)}${d.slice(-4)}` : d;
}

function isThaiFullName(name: string) {
  return /^[ก-๙]+(?:\s+[ก-๙]+)+$/.test(name.trim());
}

export function FarmerWizard({ lineUserId, onSubmitted }: FarmerWizardProps) {
  const ocr = useOcrIdCard();
  const [step, setStep] = useState<Step>('personal');
  const [fullName,    setFullName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [citizenId,   setCitizenId]   = useState('');
  const [address,     setAddress]     = useState('');
  const [houseNo,     setHouseNo]     = useState('');
  const [moo,         setMoo]         = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [district,    setDistrict]    = useState('');
  const [province,    setProvince]    = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [plots, setPlots] = useState<PlotDraft[]>([newPlotDraft()]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // auto-fill จาก OCR
  function handleOcrScan(file: File) {
    void ocr.scan(file).then((res) => {
      if (!res) return;
      if (res.fullName && isThaiFullName(res.fullName) && !fullName) setFullName(res.fullName);
      if (res.citizenId   && !citizenId)   setCitizenId(res.citizenId);
      if (res.address     && !address)     setAddress(res.address);
      if (res.houseNo     && !houseNo)     setHouseNo(res.houseNo);
      if (res.moo         && !moo)         setMoo(res.moo);
      if (res.subdistrict && !subdistrict) setSubdistrict(res.subdistrict);
      if (res.district    && !district)    setDistrict(res.district);
      if (res.province    && !province)    setProvince(res.province);
      if (res.bankAccountName && isThaiFullName(res.bankAccountName) && !bankAccountName) setBankAccountName(res.bankAccountName);
    });
  }

  const personalValid =
    isThaiFullName(fullName) && phone.trim() && citizenId.replace(/\D/g, '').length === 13;

  const plotsValid = plots.every(
    (p) => p.name.trim() && Number(p.areaRai) > 0 && p.lat !== null
  );

  function updatePlot(id: string, updated: PlotDraft) {
    setPlots((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  function removePlot(id: string) {
    setPlots((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const idToken = await ensureLiffIdToken();
      if (!idToken) { setError('ไม่พบ LINE session'); return; }

      const formData = new FormData();
      formData.append('idToken', idToken);
      formData.append('fullName', fullName.trim());
      formData.append('phone', phone.trim());
      formData.append('citizenIdMasked', maskId(citizenId));
      formData.append('address',     address.trim());
      formData.append('houseNo',     houseNo.trim());
      formData.append('moo',         moo.trim());
      formData.append('subdistrict', subdistrict.trim());
      formData.append('district',    district.trim());
      formData.append('province',    province.trim());
      formData.append('bankName', bankName.trim());
      formData.append('bankAccountNumber', bankAccountNumber.trim());
      formData.append('bankAccountName', bankAccountName.trim());
      formData.append('plots', JSON.stringify(plots.map((p) => ({
        name: p.name, areaRai: Number(p.areaRai),
        lat: p.lat, lng: p.lng, accuracy: p.accuracy,
        landDocType: p.landDocType || null,
        landDocNumber: p.landDocNumber || null,
        subdistrict: p.subdistrict || null,
        district:    p.district    || null,
        province:    p.province    || null,
      }))));

      plots.forEach((p, i) => {
        if (p.photoFile) formData.append(`plotPhoto_${i}`, p.photoFile);
      });

      const res = await fetch('/api/member/register-farmer', { method: 'POST', body: formData });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) { setError(payload.error ?? 'ส่งคำขอไม่สำเร็จ'); return; }

      onSubmitted();
    } catch { setError('การเชื่อมต่อขัดข้อง'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="mobile-stack">
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {(['personal', 'plots', 'review'] as Step[]).map((s, i) => (
          <div key={s} style={{ width: 28, height: 4, borderRadius: 2, background: step === s ? 'var(--primary)' : ((['personal','plots','review'].indexOf(step) > i) ? '#a5d6a7' : 'var(--border)') }} />
        ))}
      </div>

      {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

      {/* Step 1: ข้อมูลส่วนตัว */}
      {step === 'personal' && (
        <div className="mobile-stack">
          <OcrIdCardStep status={ocr.status} result={ocr.result} error={ocr.error} onScan={handleOcrScan} onReset={ocr.reset} />
          <label className="reg-label">ชื่อ-นามสกุล <span className="reg-required">*</span>
            <input className="reg-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อตามบัตรประชาชน" />
            {fullName.trim() && !isThaiFullName(fullName) && <span className="reg-hint" style={{ color: 'var(--danger)' }}>กรุณากรอกชื่อ-นามสกุลภาษาไทยเท่านั้น</span>}
          </label>
          <label className="reg-label">เบอร์โทรศัพท์ <span className="reg-required">*</span>
            <input className="reg-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0XX-XXX-XXXX" />
          </label>
          <label className="reg-label">เลขบัตรประชาชน 13 หลัก <span className="reg-required">*</span>
            <input className="reg-input" inputMode="numeric" maxLength={13} value={citizenId} onChange={(e) => setCitizenId(e.target.value)} placeholder="1234567890123" />
            {citizenId && <span className="reg-hint">แสดงผล: {maskId(citizenId)}</span>}
          </label>
          <p className="reg-label" style={{ marginBottom: 4 }}>ที่อยู่ตามบัตร</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="reg-label">บ้านเลขที่
              <input className="reg-input" value={houseNo} onChange={(e) => setHouseNo(e.target.value)} placeholder="123/4" />
            </label>
            <label className="reg-label">หมู่ที่
              <input className="reg-input" value={moo} onChange={(e) => setMoo(e.target.value)} placeholder="5" />
            </label>
            <label className="reg-label">ตำบล/แขวง
              <input className="reg-input" value={subdistrict} onChange={(e) => setSubdistrict(e.target.value)} placeholder="ตำบล" />
            </label>
            <label className="reg-label">อำเภอ/เขต
              <input className="reg-input" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="อำเภอ" />
            </label>
          </div>
          <label className="reg-label">จังหวัด
            <input className="reg-input" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="จังหวัด" />
          </label>
          <label className="reg-label">ที่อยู่เต็ม (จากบัตร)
            <textarea className="reg-input reg-textarea" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด" />
          </label>
          <p className="reg-label" style={{ marginBottom: 4 }}>ข้อมูลบัญชีธนาคาร (ส่วนที่ 2)</p>
          <label className="reg-label">ธนาคาร
            <input className="reg-input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="เช่น ธ.ก.ส." />
          </label>
          <label className="reg-label">เลขบัญชี
            <input className="reg-input" inputMode="numeric" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="เลขบัญชี" />
          </label>
          <label className="reg-label">ชื่อบัญชี
            <input className="reg-input" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="ชื่อตามหน้าสมุดบัญชี" />
          </label>
          <UIButton fullWidth onClick={() => setStep('plots')} disabled={!personalValid}>ถัดไป: ข้อมูลแปลง →</UIButton>
        </div>
      )}

      {/* Step 2: แปลง */}
      {step === 'plots' && (
        <div className="mobile-stack">
          <p style={{ margin: 0, fontWeight: 700 }}>📌 ข้อมูลแปลงเกษตร</p>
          {plots.map((p, i) => (
            <PlotItem key={p.id} plot={p} index={i} onChange={(u) => updatePlot(p.id, u)} onRemove={() => removePlot(p.id)} canRemove={plots.length > 1} />
          ))}
          <UIButton variant="secondary" fullWidth onClick={() => setPlots((prev) => [...prev, newPlotDraft()])}>+ เพิ่มแปลงอีกแปลง</UIButton>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <UIButton variant="ghost" onClick={() => setStep('personal')}>← ย้อนกลับ</UIButton>
            <UIButton onClick={() => setStep('review')} disabled={!plotsValid}>ถัดไป: ตรวจสอบ →</UIButton>
          </div>
        </div>
      )}

      {/* Step 3: ตรวจสอบ */}
      {step === 'review' && (
        <div className="mobile-stack">
          <div className="kaona-card">
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>ข้อมูลส่วนตัว</p>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>ชื่อ: {fullName}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13 }}>เบอร์: {phone}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13 }}>บัตร: {maskId(citizenId)}</p>
          </div>
          <div className="kaona-card">
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>แปลงเกษตร ({plots.length} แปลง)</p>
            {plots.map((p, i) => (
              <p key={p.id} style={{ margin: '4px 0 0', fontSize: 13 }}>• แปลงที่ {i + 1}: {p.name} — {p.areaRai} ไร่ {p.lat ? '📍' : '⚠️ ไม่มี GPS'}</p>
            ))}
          </div>
          <label className="reg-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>ยินยอมให้ระบบใช้ข้อมูลเพื่อยืนยันตัวตนและพิจารณาสมัครสมาชิก</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <UIButton variant="ghost" onClick={() => setStep('plots')}>← แก้ไขแปลง</UIButton>
            <UIButton onClick={handleSubmit} disabled={!consent || submitting} loading={submitting}>ส่งคำขอ ✓</UIButton>
          </div>
        </div>
      )}
    </div>
  );
}
