'use client';

import { useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import { processImageForEvidence } from '@/shared/lib/image-processing';

type EvidenceUploaderProps = {
  inspectionId: string;
};

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET || 'mvp-evidence';

export function EvidenceUploader({ inspectionId }: EvidenceUploaderProps) {
  const { member } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracy: number; capturedAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  function captureGps() {
    setError(null);
    if (!navigator.geolocation) return setError('อุปกรณ์นี้ไม่รองรับ GPS');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
      },
      (geoError) => setError(geoError.message || 'จับพิกัดไม่สำเร็จ'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function upload() {
    setError(null);
    setDone(null);
    if (!member?.member_id) return setError('ไม่พบข้อมูลสมาชิก');
    if (!file) return setError('กรุณาเลือกรูปหลักฐาน');
    if (!geo) return setError('กรุณาจับพิกัด GPS ก่อนอัปโหลด');

    setUploading(true);
    try {
      const { processedFile, widthPx, heightPx, fileSizeBytes } = await processImageForEvidence(file);
      const supabase = createSupabaseBrowserClient();
      const storagePath = `evidence/${member.member_id}/inspection-${inspectionId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(storagePath, processedFile, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('photos').insert({
        member_id: member.member_id,
        uploaded_by: member.member_id,
        inspection_id: inspectionId,
        storage_path: storagePath,
        processed_storage_path: storagePath,
        original_storage_path: null,
        width_px: widthPx,
        height_px: heightPx,
        file_size_bytes: fileSizeBytes,
        mime_type: 'image/jpeg',
        lat: geo.lat,
        lng: geo.lng,
        accuracy: geo.accuracy,
        captured_at: geo.capturedAt,
        gps_source: 'device',
        gps_verified: false,
        evidence_status: 'submitted',
        processing_status: 'processed',
        photo_type: 'inspection',
      });
      if (insertError) throw insertError;
      setDone('อัปโหลดหลักฐานสำเร็จ');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'อัปโหลดล้มเหลว');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p>แนบรูปหลักฐานงานตรวจ + GPS</p>
      <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {previewUrl ? <img src={previewUrl} alt="หลักฐาน" className="photo-evidence-foundation__preview" /> : null}
      <button type="button" className="photo-evidence-foundation__gps-btn" onClick={captureGps}>จับพิกัด GPS</button>
      <button type="button" className="photo-evidence-foundation__gps-btn" disabled={uploading} onClick={upload}>{uploading ? 'กำลังอัปโหลด...' : 'บันทึกหลักฐาน'}</button>
      {geo ? <p>GPS: {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)} ±{Math.round(geo.accuracy)}m</p> : null}
      {error ? <p className="photo-evidence-foundation__error">{error}</p> : null}
      {done ? <p>{done}</p> : null}
    </div>
  );
}
