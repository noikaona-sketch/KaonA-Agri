'use client';

import { useState } from 'react';

import { ensureLiffIdToken } from '@/lib/liff/init-liff';
import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

import { OcrIdCardStep } from '../register-farmer/ocr-id-card-step';
import { useOcrIdCard } from '../register-farmer/use-ocr-id-card';
import { VehicleItem, newVehicleDraft } from './vehicle-item';
import type { VehicleDraft } from './vehicle-item';

type TruckWizardProps = {
  lineUserId: string;
  onSubmitted: () => void;
};

type Step = 'personal' | 'vehicles' | 'review';

function maskId(v: string) {
  const d = v.replace(/\D/g, '');
  return d.length > 4 ? `${'*'.repeat(d.length - 4)}${d.slice(-4)}` : d;
}

export function TruckWizard({ lineUserId, onSubmitted }: TruckWizardProps) {
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
  const [vehicles, setVehicles] = useState<VehicleDraft[]>([newVehicleDraft()]);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOcrScan(file: File) {
    void ocr.scan(file).then((res) => {
      if (!res) return;
      if (res.fullName    && !fullName)    setFullName(res.fullName);
      if (res.citizenId   && !citizenId)   setCitizenId(res.citizenId);
      if (res.address     && !address)     setAddress(res.address);
      if (res.houseNo     && !houseNo)     setHouseNo(res.houseNo);
      if (res.moo         && !moo)         setMoo(res.moo);
      if (res.subdistrict && !subdistrict) setSubdistrict(res.subdistrict);
      if (res.district    && !district)    setDistrict(res.district);
      if (res.province    && !province)    setProvince(res.province);
    });
  }

  const personalValid = fullName.trim() && phone.trim() && citizenId.replace(/\D/g, '').length === 13;
  const vehiclesValid = vehicles.every((v) => v.vehicleType && v.plateNumber.trim());

  function updateVehicle(id: string, updated: VehicleDraft) {
    setVehicles((prev) => prev.map((v) => (v.id === id ? updated : v)));
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
      formData.append('vehicles', JSON.stringify(vehicles.map((v) => ({
        vehicleType: v.vehicleType,
        plateNumber: v.plateNumber.trim().toUpperCase(),
        brand: v.brand || null,
        model: v.model || null,
        yearBe: v.yearBe ? Number(v.yearBe) : null,
        province: v.province || null,
        capacityTon: v.capacityTon ? Number(v.capacityTon) : null,
      }))));

      vehicles.forEach((v, i) => {
        if (v.photoFile) formData.append(`vehiclePhoto_${i}`, v.photoFile);
      });

      const res = await fetch('/api/member/register-truck', { method: 'POST', body: formData });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) { setError(payload.error ?? 'ส่งคำขอไม่สำเร็จ'); return; }
      onSubmitted();
    } catch { setError('การเชื่อมต่อขัดข้อง'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="mobile-stack">
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {(['personal', 'vehicles', 'review'] as Step[]).map((s, i) => (
          <div key={s} style={{ width: 28, height: 4, borderRadius: 2, background: step === s ? '#f9a825' : ((['personal','vehicles','review'].indexOf(step) > i) ? '#ffe082' : 'var(--border)') }} />
        ))}
      </div>

      {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

      {step === 'personal' && (
        <div className="mobile-stack">
          <OcrIdCardStep status={ocr.status} result={ocr.result} error={ocr.error} debug={ocr.debug} onScan={handleOcrScan} onReset={ocr.reset} />
          <label className="reg-label">ชื่อ-นามสกุล <span className="reg-required">*</span>
            <input className="reg-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อตามบัตรประชาชน" />
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
          <UIButton fullWidth onClick={() => setStep('vehicles')} disabled={!personalValid}>ถัดไป: ข้อมูลรถ →</UIButton>
        </div>
      )}

      {step === 'vehicles' && (
        <div className="mobile-stack">
          <p style={{ margin: 0, fontWeight: 700 }}>🚛 ข้อมูลรถ</p>
          {vehicles.map((v, i) => (
            <VehicleItem key={v.id} vehicle={v} index={i} onChange={(u) => updateVehicle(v.id, u)} onRemove={() => setVehicles((prev) => prev.filter((x) => x.id !== v.id))} canRemove={vehicles.length > 1} />
          ))}
          <UIButton variant="secondary" fullWidth onClick={() => setVehicles((prev) => [...prev, newVehicleDraft()])}>+ เพิ่มรถอีกคัน</UIButton>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <UIButton variant="ghost" onClick={() => setStep('personal')}>← ย้อนกลับ</UIButton>
            <UIButton onClick={() => setStep('review')} disabled={!vehiclesValid}>ถัดไป: ตรวจสอบ →</UIButton>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="mobile-stack">
          <div className="kaona-card">
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>ข้อมูลส่วนตัว</p>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>ชื่อ: {fullName} · เบอร์: {phone}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13 }}>บัตร: {maskId(citizenId)}</p>
          </div>
          <div className="kaona-card">
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>รถ ({vehicles.length} คัน)</p>
            {vehicles.map((v, i) => (
              <p key={v.id} style={{ margin: '4px 0 0', fontSize: 13 }}>• คันที่ {i + 1}: {v.plateNumber} {v.brand} {v.model}</p>
            ))}
          </div>
          <label className="reg-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>ยินยอมให้ระบบใช้ข้อมูลเพื่อยืนยันตัวตนและพิจารณาสมัครทีมบริการ</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <UIButton variant="ghost" onClick={() => setStep('vehicles')}>← แก้ไขรถ</UIButton>
            <UIButton onClick={handleSubmit} disabled={!consent || submitting} loading={submitting}>ส่งคำขอ ✓</UIButton>
          </div>
        </div>
      )}
    </div>
  );
}
