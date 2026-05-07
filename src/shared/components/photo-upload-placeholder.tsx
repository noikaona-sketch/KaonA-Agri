'use client';

import { useEffect, useMemo, useState } from 'react';

type PhotoUploadPlaceholderProps = {
  label?: string;
};

type GeoState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoUploadPlaceholder({ label = 'Photo evidence upload' }: PhotoUploadPlaceholderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [geo, setGeo] = useState<GeoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturingGeo, setCapturingGeo] = useState(false);

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
    </section>
  );
}
