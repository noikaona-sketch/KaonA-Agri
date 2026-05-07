'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { LoadingState } from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type PlotRow = {
  id: string;
  name: string;
  area_rai: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  status: 'active' | 'inactive' | 'pending_review';
  created_at: string;
};

type GPSState = {
  lat: number;
  lng: number;
  accuracy: number;
};

export function PlotRegistrationScreen() {
  const member = useCurrentMember();
  const effectiveRole = useEffectiveRole();

  const [name, setName] = useState('');
  const [areaRai, setAreaRai] = useState('');
  const [gps, setGps] = useState<GPSState | null>(null);
  const [capturingGps, setCapturingGps] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [loadingPlots, setLoadingPlots] = useState(true);
  const [plots, setPlots] = useState<PlotRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadPlots() {
    if (!member) return;

    setLoadingPlots(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: queryError } = await supabase
      .from('plots')
      .select('id,name,area_rai,lat,lng,accuracy,status,created_at')
      .eq('member_id', member.member_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    setLoadingPlots(false);

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setPlots((data ?? []) as PlotRow[]);
  }

  useEffect(() => {
    void loadPlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.member_id]);

  function captureGps() {
    setError(null);
    setSuccessMessage(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('GPS is unavailable on this device/browser. Please enable location services and retry.');
      return;
    }

    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setCapturingGps(false);
      },
      (geoError) => {
        setError(geoError.message || 'Unable to capture GPS location.');
        setCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function submitPlot() {
    setError(null);
    setSuccessMessage(null);

    if (!member) return setError('Member not found. Please sign in again.');
    if (!name.trim()) return setError('Plot name is required.');

    const parsedArea = Number(areaRai);
    if (!Number.isFinite(parsedArea) || parsedArea <= 0) return setError('Area (rai) must be greater than 0.');

    if (!gps) return setError('Please capture GPS before submitting plot registration.');

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const { error: insertError } = await supabase.from('plots').insert({
      member_id: member.member_id,
      name: name.trim(),
      area_rai: parsedArea,
      lat: gps.lat,
      lng: gps.lng,
      accuracy: gps.accuracy,
      status: 'active',
      created_by: member.member_id,
      role_used: effectiveRole ?? 'farmer',
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setAreaRai('');
    setGps(null);
    setSuccessMessage('Plot registered successfully.');
    await loadPlots();
  }

  return (
    <MobileAppShell title="Plot registration" subtitle="Register and view your farm plots" roleBadge={effectiveRole ?? 'farmer'}>
      <SectionHeader title="Register a new plot" subtitle="GPS coordinates are required" />
      <FormSheet
        title="Plot details"
        footer={
          <UIButton onClick={submitPlot} loading={submitting} disabled={submitting} fullWidth>
            Save plot
          </UIButton>
        }
      >
        <label>
          Plot name
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} />
        </label>
        <label>
          Area (rai)
          <input type="number" min="0" step="0.01" value={areaRai} onChange={(event) => setAreaRai(event.target.value)} disabled={submitting} />
        </label>
        <UIButton type="button" onClick={captureGps} disabled={capturingGps || submitting} fullWidth>
          {capturingGps ? 'Capturing GPS…' : 'Capture GPS'}
        </UIButton>
        {gps ? (
          <p>
            Lat: {gps.lat.toFixed(6)} · Lng: {gps.lng.toFixed(6)} · Accuracy: ±{Math.round(gps.accuracy)}m
          </p>
        ) : (
          <p>GPS not captured yet.</p>
        )}
        {error ? <ErrorState title="Plot registration error" detail={error} /> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </FormSheet>

      <SectionHeader title="My plots" subtitle="Owned by current member" />
      {loadingPlots ? <LoadingState label="Loading plots" /> : null}
      {!loadingPlots && plots.length === 0 ? <EmptyState title="No plots yet" detail="Register your first plot above." /> : null}
      {!loadingPlots
        ? plots.map((plot) => (
            <InfoCard
              key={plot.id}
              title={plot.name}
              subtitle={`Area: ${plot.area_rai} rai · Lat: ${Number(plot.lat).toFixed(6)} · Lng: ${Number(plot.lng).toFixed(6)} · Accuracy: ${plot.accuracy ? `±${Math.round(plot.accuracy)}m` : 'N/A'}`}
              meta={<StatusChip status={plot.status === 'active' ? 'approved' : 'under_review'} />}
            />
          ))
        : null}
    </MobileAppShell>
  );
}
