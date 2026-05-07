'use client';

import { useEffect, useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type PlotStatus = 'active' | 'pending_review';

type PlotRow = {
  id: string;
  member_id: string;
  plot_name: string;
  area_rai: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  gps_captured_at: string | null;
  status: PlotStatus;
  created_at: string | null;
};

type GpsPoint = {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
};

const GPS_GOOD_ACCURACY_METERS = 30;

function formatDateTime(value: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function resolvePlotStatus(gps: GpsPoint): PlotStatus {
  return gps.accuracy <= GPS_GOOD_ACCURACY_METERS ? 'active' : 'pending_review';
}

function plotStatusLabel(status: PlotStatus) {
  return status === 'active' ? 'Active' : 'Pending review';
}

export function PlotRegistrationGps() {
  const member = useCurrentMember();
  const [plotName, setPlotName] = useState('');
  const [areaRai, setAreaRai] = useState('');
  const [gps, setGps] = useState<GpsPoint | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [plots, setPlots] = useState<PlotRow[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function loadPlots() {
    if (!member) return;

    setLoadingPlots(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from('plots')
      .select('id, member_id, plot_name, area_rai, lat, lng, accuracy, gps_captured_at, status, created_at')
      .order('created_at', { ascending: false });

    setLoadingPlots(false);

    if (loadError) {
      setError(loadError.message);
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
    setSuccess(null);

    if (!navigator.geolocation) {
      setError('GPS is not available on this device or browser.');
      return;
    }

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLoading(false);
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      (geoError) => {
        setGpsLoading(false);
        setError(geoError.message || 'Unable to capture GPS. Please allow location access and try again.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function submitPlot() {
    setError(null);
    setSuccess(null);

    if (!member?.is_approved || member.status !== 'approved') {
      setError('Only approved members can create plots.');
      return;
    }

    const cleanPlotName = plotName.trim();
    const area = Number(areaRai);

    if (!cleanPlotName) {
      setError('Please enter plot name.');
      return;
    }

    if (!Number.isFinite(area) || area <= 0) {
      setError('Area must be greater than 0 rai.');
      return;
    }

    if (!gps) {
      setError('Please capture GPS before submitting plot.');
      return;
    }

    setSubmitting(true);

    const { error: insertError } = await supabase.from('plots').insert({
      plot_name: cleanPlotName,
      area_rai: area,
      lat: gps.lat,
      lng: gps.lng,
      accuracy: gps.accuracy,
      gps_captured_at: gps.capturedAt,
      status: resolvePlotStatus(gps),
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setPlotName('');
    setAreaRai('');
    setGps(null);
    setSuccess('Plot saved.');
    await loadPlots();
  }

  return (
    <>
      <SectionHeader title="Plot registration" subtitle="Register your farm plot with GPS evidence." />

      <FormSheet
        title="New plot"
        footer={
          <UIButton onClick={submitPlot} loading={submitting} fullWidth>
            Save plot
          </UIButton>
        }
      >
        <label>
          Plot name
          <input value={plotName} onChange={(event) => setPlotName(event.target.value)} disabled={submitting} placeholder="Example: North field" />
        </label>
        <label>
          Area (rai)
          <input
            value={areaRai}
            onChange={(event) => setAreaRai(event.target.value)}
            disabled={submitting}
            inputMode="decimal"
            placeholder="Example: 12.5"
          />
        </label>

        <div className="photo-evidence-foundation__meta">
          <p><strong>GPS status:</strong> {gps ? 'Captured' : 'Not captured'}</p>
          {gps ? (
            <>
              <p><strong>Lat:</strong> {formatCoordinate(gps.lat)}</p>
              <p><strong>Lng:</strong> {formatCoordinate(gps.lng)}</p>
              <p><strong>Accuracy:</strong> ±{Math.round(gps.accuracy)} m</p>
              <p><strong>Captured:</strong> {formatDateTime(gps.capturedAt)}</p>
              <p><strong>Save status:</strong> {plotStatusLabel(resolvePlotStatus(gps))}</p>
            </>
          ) : null}
        </div>

        <UIButton type="button" variant="secondary" onClick={captureGps} loading={gpsLoading} disabled={submitting} fullWidth>
          Capture GPS
        </UIButton>

        {error ? <ErrorState title="Plot registration failed" detail={error} /> : null}
        {success ? <p>{success}</p> : null}
      </FormSheet>

      <SectionHeader title="My plots" subtitle="Existing plots linked to your member profile." />

      {loadingPlots ? <p>Loading plots…</p> : null}
      {!loadingPlots && plots.length === 0 ? <EmptyState title="No plots yet" detail="Capture GPS and save your first plot." /> : null}
      {!loadingPlots && plots.length > 0
        ? plots.map((plot) => (
            <InfoCard
              key={plot.id}
              title={plot.plot_name}
              subtitle={`${plot.area_rai} rai • ${formatCoordinate(plot.lat)}, ${formatCoordinate(plot.lng)} • ±${Math.round(plot.accuracy ?? 0)} m`}
              meta={<StatusChip status={plot.status === 'active' ? 'approved' : 'under_review'} />}
              action={<p>GPS captured: {formatDateTime(plot.gps_captured_at)}</p>}
            />
          ))
        : null}
    </>
  );
}
