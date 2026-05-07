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

type PlotOption = { id: string; name: string };

type PlantingCycleRow = {
  id: string;
  crop_name: string;
  season_year: number;
  planted_at: string | null;
  expected_harvest_at: string | null;
  status: 'planned' | 'growing' | 'completed' | 'cancelled';
  plot: { name: string }[] | null;
  created_at: string;
};

const statusToChip: Record<PlantingCycleRow['status'], 'under_review' | 'approved' | 'submitted' | 'rejected'> = {
  planned: 'under_review',
  growing: 'approved',
  completed: 'submitted',
  cancelled: 'rejected',
};

export function PlantingCycleManagementScreen() {
  const member = useCurrentMember();
  const effectiveRole = useEffectiveRole();
  const [plots, setPlots] = useState<PlotOption[]>([]);
  const [cycles, setCycles] = useState<PlantingCycleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [plotId, setPlotId] = useState('');
  const [cropName, setCropName] = useState('');
  const [seasonYear, setSeasonYear] = useState(String(new Date().getFullYear()));
  const [plantedAt, setPlantedAt] = useState('');
  const [expectedHarvestAt, setExpectedHarvestAt] = useState('');

  async function loadData() {
    if (!member) return;
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const [{ data: plotsData, error: plotsError }, { data: cyclesData, error: cyclesError }] = await Promise.all([
      supabase.from('plots').select('id,name').eq('member_id', member.member_id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase
        .from('planting_cycles')
        .select('id,crop_name,season_year,planted_at,expected_harvest_at,status,created_at,plot:plots(name)')
        .eq('member_id', member.member_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    setLoading(false);
    if (plotsError || cyclesError) {
      setError(plotsError?.message ?? cyclesError?.message ?? 'Failed to load planting cycle data.');
      return;
    }
    const resolvedPlots = (plotsData ?? []) as PlotOption[];
    setPlots(resolvedPlots);
    setPlotId((currentPlotId) => currentPlotId || resolvedPlots[0]?.id || '');
    setCycles(((cyclesData ?? []) as PlantingCycleRow[]));
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.member_id]);

  async function createCycle() {
    setError(null);
    setSuccessMessage(null);
    if (!member) return setError('Member not found. Please sign in again.');
    if (!plotId) return setError('Please select a plot.');
    if (!cropName.trim()) return setError('Crop name is required.');
    const parsedSeasonYear = Number(seasonYear);
    if (!Number.isInteger(parsedSeasonYear) || parsedSeasonYear < 2000 || parsedSeasonYear > 2100) return setError('Season year must be a valid year between 2000 and 2100.');
    if (plantedAt && expectedHarvestAt && expectedHarvestAt < plantedAt) return setError('Expected harvest date must be the same or later than planted date.');
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from('planting_cycles').insert({
      plot_id: plotId,
      member_id: member.member_id,
      crop_name: cropName.trim(),
      season_year: parsedSeasonYear,
      planted_at: plantedAt || null,
      expected_harvest_at: expectedHarvestAt || null,
      status: 'planned',
      created_by: member.member_id,
      role_used: effectiveRole ?? 'farmer',
    });
    setSubmitting(false);
    if (insertError) return setError(insertError.message);
    setCropName('');
    setPlantedAt('');
    setExpectedHarvestAt('');
    setSuccessMessage('Planting cycle created successfully.');
    await loadData();
  }

  async function updateStatus(cycleId: string, nextStatus: PlantingCycleRow['status']) {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.from('planting_cycles').update({ status: nextStatus }).eq('id', cycleId);
    if (updateError) return setError(updateError.message);
    setSuccessMessage(`Cycle moved to ${nextStatus}.`);
    await loadData();
  }

  return (
    <MobileAppShell title="Planting cycles" subtitle="Create and manage seasonal crop cycles" roleBadge={effectiveRole ?? 'farmer'}>
      <SectionHeader title="Create planting cycle" subtitle="Link each cycle to one registered plot" />
      <FormSheet title="Cycle details" footer={<UIButton onClick={createCycle} loading={submitting} disabled={submitting} fullWidth>Save planting cycle</UIButton>}>
        <label>
          Plot
          <select value={plotId} onChange={(event) => setPlotId(event.target.value)} disabled={submitting || plots.length === 0}>
            {plots.length === 0 ? <option value="">No plots available</option> : null}
            {plots.map((plot) => (
              <option key={plot.id} value={plot.id}>{plot.name}</option>
            ))}
          </select>
        </label>
        <label>Crop name<input value={cropName} onChange={(event) => setCropName(event.target.value)} disabled={submitting} /></label>
        <label>Season year<input type="number" value={seasonYear} onChange={(event) => setSeasonYear(event.target.value)} disabled={submitting} /></label>
        <label>Planted date<input type="date" value={plantedAt} onChange={(event) => setPlantedAt(event.target.value)} disabled={submitting} /></label>
        <label>Expected harvest date<input type="date" value={expectedHarvestAt} onChange={(event) => setExpectedHarvestAt(event.target.value)} disabled={submitting} /></label>
        {error ? <ErrorState title="Planting cycle error" detail={error} /> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </FormSheet>

      <SectionHeader title="My planting cycles" subtitle="Update cycle progress through the season" />
      {loading ? <LoadingState label="Loading planting cycles" /> : null}
      {!loading && cycles.length === 0 ? <EmptyState title="No planting cycles yet" detail="Create your first cycle above." /> : null}
      {!loading ? cycles.map((cycle) => (
        <InfoCard
          key={cycle.id}
          title={`${cycle.crop_name} (${cycle.season_year})`}
          subtitle={`Plot: ${cycle.plot?.[0]?.name ?? 'Unknown'} · Planted: ${cycle.planted_at ?? '-'} · Harvest: ${cycle.expected_harvest_at ?? '-'}`}
          meta={<StatusChip status={statusToChip[cycle.status]} />}
          action={cycle.status === 'planned' ? <UIButton fullWidth onClick={() => updateStatus(cycle.id, 'growing')}>Start growing</UIButton> : cycle.status === 'growing' ? <UIButton fullWidth onClick={() => updateStatus(cycle.id, 'completed')}>Mark completed</UIButton> : null}
        />
      )) : null}
    </MobileAppShell>
  );
}
