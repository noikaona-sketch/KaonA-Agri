'use client';

import { type ChangeEvent, useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader } from '@/shared/components/section-header';
import { UIButton } from '@/shared/components/ui-button';
import { processImageForEvidence } from '@/shared/lib/image-processing';

type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

type Step = 'details' | 'photos' | 'review';

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET || 'mvp-evidence';

export function PlotRegistrationMVP() {
  const member = useCurrentMember();
  const effectiveRole = useEffectiveRole();

  const [step, setStep] = useState<Step>('details');
  const [plotName, setPlotName] = useState('');
  const [areaRai, setAreaRai] = useState('');
  const [plotNote, setPlotNote] = useState('');
  const [geo, setGeo] = useState<GeoLocation | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [capturingGeo, setCapturingGeo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const areaValue = Number(areaRai);
  const detailsValid = plotName.trim().length > 0 && Number.isFinite(areaValue) && areaValue > 0;
  const reviewValid = detailsValid && geo && photos.length > 0;

  const canSubmit = useMemo(() => Boolean(reviewValid), [reviewValid]);

  function onSelectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setPhotos((previous) => [...previous, ...files].slice(0, 4));
  }

  function removePhoto(index: number) {
    setPhotos((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  }

  function captureGPS() {
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง GPS');
      return;
    }

    setCapturingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
        setCapturingGeo(false);
      },
      (geoError) => {
        setError(geoError.message || 'ไม่สามารถจับพิกัด GPS ได้ กรุณาลองใหม่');
        setCapturingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function submitDraft() {
    setError(null);
    setDoneMessage(null);

    if (!member?.member_id) return setError('ไม่พบข้อมูลสมาชิก กรุณาเข้าสู่ระบบใหม่');
    if (!member?.is_approved || member.status !== 'approved') return setError('เฉพาะสมาชิกที่อนุมัติแล้วเท่านั้นที่ลงทะเบียนแปลงได้');
    if (!geo) return setError('กรุณากดจับพิกัด GPS ก่อนส่งข้อมูล');
    if (photos.length === 0) return setError('กรุณาแนบรูปแปลงอย่างน้อย 1 รูป');

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const { data: plotRow, error: plotError } = await supabase
      .from('plots')
      .insert({
        member_id: member.member_id,
        created_by: member.member_id,
        role_used: member.effective_role ?? 'farmer',
        name: plotName.trim(),
        area_rai: areaValue,
        lat: geo.latitude,
        lng: geo.longitude,
        accuracy: geo.accuracy,
        status: 'draft',
      })
      .select('id')
      .single();

    if (plotError || !plotRow) {
      setSubmitting(false);
      setError(plotError?.message ?? 'ไม่สามารถบันทึกร่างแปลงได้');
      return;
    }

    for (const photo of photos) {
      const { processedFile, widthPx, heightPx, fileSizeBytes } = await processImageForEvidence(photo);
      const storagePath = `evidence/${member.member_id}/plots/${plotRow.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;

      const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, processedFile, {
        upsert: false,
        contentType: 'image/jpeg',
      });

      if (uploadError) {
        setSubmitting(false);
        setError(uploadError.message);
        return;
      }

      const { error: photoError } = await supabase.from('photos').insert({
        member_id: member.member_id,
        uploaded_by: member.member_id,
        plot_id: plotRow.id,
        storage_path: storagePath,
        processed_storage_path: storagePath,
        width_px: widthPx,
        height_px: heightPx,
        file_size_bytes: fileSizeBytes,
        mime_type: 'image/jpeg',
        lat: geo.latitude,
        lng: geo.longitude,
        accuracy: geo.accuracy,
        captured_at: geo.capturedAt,
        gps_source: 'device',
        gps_verified: false,
        evidence_status: 'submitted',
        processing_status: 'processed',
        photo_type: 'plot',
      });

      if (photoError) {
        setSubmitting(false);
        setError(photoError.message);
        return;
      }
    }

    setSubmitting(false);
    setDoneMessage('บันทึกร่างแปลงเรียบร้อยแล้ว เจ้าหน้าที่จะตรวจสอบต่อไป');
    setStep('details');
    setPlotName('');
    setAreaRai('');
    setPlotNote('');
    setGeo(null);
    setPhotos([]);
  }

  return (
    <MobileAppShell title="ลงทะเบียนแปลงเกษตร" subtitle="MVP: เก็บพิกัดเมื่อผู้ใช้กดเท่านั้น" roleBadge={effectiveRole ?? 'farmer'}>
      <SectionHeader title="ขั้นตอนลงทะเบียน" subtitle="รายละเอียดแปลง → แนบรูป → ตรวจทาน → บันทึกร่าง" />

      {step === 'details' ? (
        <section className="kaona-card">
          <h3>1) รายละเอียดแปลง</h3>
          <label>
            ชื่อแปลง
            <input value={plotName} onChange={(event) => setPlotName(event.target.value)} disabled={submitting} />
          </label>
          <label>
            พื้นที่ (ไร่)
            <input type="number" inputMode="decimal" min="0" step="0.01" value={areaRai} onChange={(event) => setAreaRai(event.target.value)} disabled={submitting} />
          </label>
          <label>
            รายละเอียดเพิ่มเติม (ไม่บังคับ)
            <textarea value={plotNote} onChange={(event) => setPlotNote(event.target.value)} disabled={submitting} rows={3} />
          </label>
          <UIButton onClick={captureGPS} disabled={capturingGeo || submitting} fullWidth>
            {capturingGeo ? 'กำลังจับพิกัด GPS…' : 'กดเพื่อจับพิกัด GPS'}
          </UIButton>
          {capturingGeo ? <LoadingState label="กำลังดึงพิกัดจากอุปกรณ์" /> : null}
          {geo ? <p>พิกัด: {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)} · ความแม่นยำ ±{Math.round(geo.accuracy)} เมตร</p> : <p>ยังไม่ได้จับพิกัด GPS</p>}
        </section>
      ) : null}

      {step === 'photos' ? (
        <section className="kaona-card">
          <h3>2) แนบรูปแปลง</h3>
          <p>แนบได้สูงสุด 4 รูป (แนะนำรูปมุมกว้างและจุดสังเกต)</p>
          <input type="file" accept="image/*" capture="environment" multiple onChange={onSelectPhotos} disabled={submitting} />
          {photos.length === 0 ? <p>ยังไม่มีรูปที่แนบ</p> : null}
          {photos.map((photo, index) => (
            <div key={`${photo.name}-${index}`}>
              <p>{photo.name}</p>
              <UIButton type="button" onClick={() => removePhoto(index)} disabled={submitting}>ลบ</UIButton>
            </div>
          ))}
        </section>
      ) : null}

      {step === 'review' ? (
        <section className="kaona-card">
          <h3>3) ตรวจทานก่อนส่งร่าง</h3>
          <p>ชื่อแปลง: {plotName}</p>
          <p>พื้นที่: {areaRai} ไร่</p>
          <p>รายละเอียด: {plotNote || 'ไม่ระบุ'}</p>
          <p>พิกัด: {geo ? `${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}` : '-'}</p>
          <p>ความแม่นยำ: {geo ? `±${Math.round(geo.accuracy)} เมตร` : '-'}</p>
          <p>จำนวนรูปแนบ: {photos.length} รูป</p>
        </section>
      ) : null}

      {error ? <ErrorState title="ไม่สามารถดำเนินการได้" detail={error} /> : null}
      {doneMessage ? <p>{doneMessage}</p> : null}

      <div>
        {step !== 'details' ? <UIButton type="button" onClick={() => setStep(step === 'photos' ? 'details' : 'photos')} disabled={submitting}>ย้อนกลับ</UIButton> : null}{' '}
        {step === 'details' ? <UIButton type="button" onClick={() => setStep('photos')} disabled={!detailsValid || !geo || submitting}>ถัดไป: แนบรูป</UIButton> : null}
        {step === 'photos' ? <UIButton type="button" onClick={() => setStep('review')} disabled={photos.length === 0 || submitting}>ถัดไป: ตรวจทาน</UIButton> : null}
        {step === 'review' ? <UIButton type="button" onClick={submitDraft} disabled={!canSubmit || submitting} loading={submitting}>ส่งเป็นร่าง</UIButton> : null}
      </div>
    </MobileAppShell>
  );
}
