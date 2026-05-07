'use client';

import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { UIButton } from '@/shared/components/ui-button';

type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

const GOOD_GPS_ACCURACY_METERS = 30;

function resolvePlotStatus(geo: GeoLocation) {
  return geo.accuracy <= GOOD_GPS_ACCURACY_METERS ? 'active' : 'pending_review';
}

export function PlotRegistrationMVP() {
  const member = useCurrentMember();

  const [plotName, setPlotName] = useState('');
  const [areaRai, setAreaRai] = useState('');
  const [geo, setGeo] = useState<GeoLocation | null>(null);
  const [capturingGeo, setCapturingGeo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  async function captureGPS() {
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported on this device.');
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
        setError(geoError.message || 'Unable to capture GPS location.');
        setCapturingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function submitPlot() {
    setError(null);
    setDoneMessage(null);

    if (!member?.is_approved || member.status !== 'approved') {
      return setError('Only approved members can register plots.');
    }
    if (!plotName.trim()) return setError('Please provide a plot name.');

    const parsedArea = Number(areaRai);
    if (!Number.isFinite(parsedArea) || parsedArea <= 0) {
      return setError('Area (rai) must be greater than 0.');
    }

    if (!geo) return setError('GPS evidence is required before plot registration.');

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const { error: insertError } = await supabase.from('plots').insert({
      plot_name: plotName.trim(),
      area_rai: parsedArea,
      lat: geo.latitude,
      lng: geo.longitude,
      accuracy: geo.accuracy,
      gps_captured_at: geo.capturedAt,
      status: resolvePlotStatus(geo),
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDoneMessage('Plot registered successfully.');
    setPlotName('');
    setAreaRai('');
    setGeo(null);
  }

  return (
    <FormSheet
      title="Plot registration"
      footer={
        <UIButton onClick={submitPlot} loading={submitting} disabled={submitting} fullWidth>
          Register plot
        </UIButton>
      }
    >
      <p>Register a farm plot with GPS coordinates for field operations.</p>
      <label>
        Plot name
        <input value={plotName} onChange={(event) => setPlotName(event.target.value)} disabled={submitting} />
      </label>
      <label>
        Area (rai)
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={areaRai}
          onChange={(event) => setAreaRai(event.target.value)}
          disabled={submitting}
        />
      </label>
      <UIButton type="button" onClick={captureGPS} disabled={capturingGeo || submitting} fullWidth>
        {capturingGeo ? 'Capturing GPS…' : 'Capture GPS location'}
      </UIButton>
      {geo ? (
        <p>
          Lat: {geo.latitude.toFixed(6)} / Lng: {geo.longitude.toFixed(6)} / Accuracy: ±{Math.round(geo.accuracy)} m
        </p>
      ) : (
        <p>GPS location not captured yet.</p>
      )}
      {error ? <ErrorState title="Plot registration failed" detail={error} /> : null}
      {doneMessage ? <p>{doneMessage}</p> : null}
    </FormSheet>
  );
}
