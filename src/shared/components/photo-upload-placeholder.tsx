'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type PhotoUploadPlaceholderProps = {
  label?: string;
};

type GeoState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

type UploadState = 'idle' | 'processing' | 'uploading' | 'saved' | 'error';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoUploadPlaceholder({ label = 'Photo evidence upload' }: PhotoUploadPlaceholderProps) {
  const { member, session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [geo, setGeo] = useState<GeoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturingGeo, setCapturingGeo] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function captureLocation() {
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this device/browser.');
      return;
    }

    setCapturingGeo(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
        setCapturingGeo(false);
      },
      (geoError) => {
        setError(geoError.message || 'Unable to capture GPS location.');
        setCapturingGeo(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  }

  async function processImage(sourceFile: File) {
    const bitmap = await createImageBitmap(sourceFile);
    const maxDimension = 2048;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to process image: missing canvas context.');
    }

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) return reject(new Error('Image compression failed.'));
        resolve(nextBlob);
      }, 'image/jpeg', 0.88);
    });

    const processedFile = new File([blob], `${Date.now()}.jpg`, { type: 'image/jpeg' });
    return { processedFile, widthPx: width, heightPx: height, fileSizeBytes: blob.size };
  }

  async function uploadEvidence() {
    setError(null);
    setLastAttemptAt(new Date().toISOString());

    if (!file) {
      setError('Please choose a photo before uploading evidence.');
      return;
    }

    if (!geo) {
      setError('GPS evidence is required before save. Capture GPS or retry geolocation.');
      return;
    }

    if (!member?.member_id || !session?.user.id) {
      setError('Missing authenticated member context.');
      return;
    }

    try {
      setUploadState('processing');
      const { processedFile, widthPx, heightPx, fileSizeBytes } = await processImage(file);
      const timestamp = Date.now();
      const basePath = `evidence/${member.member_id}/${timestamp}`;
      const processedStoragePath = `${basePath}.jpg`;
      const originalStoragePath = `${basePath}-original.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
      const supabase = createSupabaseBrowserClient();

      setUploadState('uploading');

      const { error: originalUploadError } = await supabase.storage.from('mvp-evidence').upload(originalStoragePath, file, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });
      if (originalUploadError) throw originalUploadError;

      const { error: processedUploadError } = await supabase.storage.from('mvp-evidence').upload(processedStoragePath, processedFile, {
        upsert: false,
        contentType: 'image/jpeg',
      });
      if (processedUploadError) throw processedUploadError;

      const { error: insertError } = await supabase.from('photos').insert({
        member_id: member.member_id,
        uploaded_by: member.member_id,
        storage_path: processedStoragePath,
        processed_storage_path: processedStoragePath,
        original_storage_path: originalStoragePath,
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

      if (insertError) throw insertError;
      setUploadState('saved');
    } catch (uploadError) {
      setUploadState('error');
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    }
  }

  return (
    <section className="photo-evidence-foundation" aria-label={label}>
      <p className="photo-evidence-foundation__title">{label}</p>
      <label className="photo-evidence-foundation__picker">
        <span>Choose photo</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setFile(next);
          }}
        />
      </label>

      {file ? (
        <div className="photo-evidence-foundation__meta">
          <p><strong>File:</strong> {file.name}</p>
          <p><strong>Size:</strong> {formatBytes(file.size)}</p>
          <p><strong>Type:</strong> {file.type || 'unknown'}</p>
        </div>
      ) : (
        <p className="photo-evidence-foundation__hint">No photo selected yet.</p>
      )}

      {previewUrl ? <img src={previewUrl} alt="Selected evidence preview" className="photo-evidence-foundation__preview" /> : null}

      <button type="button" onClick={captureLocation} className="photo-evidence-foundation__gps-btn" disabled={capturingGeo}>
        {capturingGeo ? 'Capturing GPS…' : 'Capture GPS evidence'}
      </button>

      {geo ? (
        <div className="photo-evidence-foundation__meta">
          <p><strong>Latitude:</strong> {geo.latitude.toFixed(6)}</p>
          <p><strong>Longitude:</strong> {geo.longitude.toFixed(6)}</p>
          <p><strong>Accuracy:</strong> ±{Math.round(geo.accuracy)} m</p>
          <p><strong>Captured at:</strong> {new Date(geo.capturedAt).toLocaleString()}</p>
        </div>
      ) : (
        <p className="photo-evidence-foundation__hint">GPS location not captured yet.</p>
      )}

      {error ? <p className="photo-evidence-foundation__error">{error}</p> : null}
      <button type="button" onClick={uploadEvidence} className="photo-evidence-foundation__gps-btn" disabled={uploadState === 'processing' || uploadState === 'uploading'}>
        {uploadState === 'processing'
          ? 'Processing image…'
          : uploadState === 'uploading'
            ? 'Uploading evidence…'
            : uploadState === 'saved'
              ? 'Saved'
              : uploadState === 'error'
                ? 'Retry upload'
                : 'Save evidence'}
      </button>
      <p className="photo-evidence-foundation__hint">Status: {uploadState}{lastAttemptAt ? ` • Last attempt: ${new Date(lastAttemptAt).toLocaleTimeString()}` : ''}</p>
    </section>
  );
}
