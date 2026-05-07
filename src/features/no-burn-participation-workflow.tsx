'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { UIButton } from '@/shared/components/ui-button';

type PlantingCycleOption = {
  id: string;
  crop_name: string;
  season_year: number;
  status: string;
};

export function NoBurnParticipationWorkflow() {
  const member = useCurrentMember();

  const [cycles, setCycles] = useState<PlantingCycleOption[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [note, setNote] = useState('');
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadCycles() {
      setLoadingCycles(true);

      const { data, error: queryError } = await supabase
        .from('planting_cycles')
        .select('id, crop_name, season_year, status')
        .order('created_at', { ascending: false })
        .limit(20);

      setLoadingCycles(false);

      if (queryError) {
        setError(queryError.message);
        return;
      }

      setCycles((data ?? []) as PlantingCycleOption[]);
    }

    void loadCycles();
  }, []);

  async function submitRequest() {
    setError(null);
    setDoneMessage(null);

    if (!member?.is_approved || member.status !== 'approved') {
      return setError('Only approved members can submit no-burn participation requests.');
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const { data, error: insertError } = await supabase
      .from('no_burn_requests')
      .insert({
        planting_cycle_id: selectedCycleId || null,
      })
      .select('id')
      .single();

    if (insertError) {
      setSubmitting(false);
      setError(insertError.message);
      return;
    }

    if (note.trim()) {
      const { error: updateError } = await supabase
        .from('no_burn_requests')
        .update({ review_note: note.trim() })
        .eq('id', data.id);

      if (updateError) {
        setSubmitting(false);
        setError(updateError.message);
        return;
      }
    }

    setSubmitting(false);
    setSelectedCycleId('');
    setNote('');
    setDoneMessage('No-burn participation request submitted successfully.');
  }

  return (
    <FormSheet
      title="No-burn participation"
      footer={
        <UIButton onClick={submitRequest} loading={submitting} disabled={submitting || loadingCycles} fullWidth>
          Submit no-burn request
        </UIButton>
      }
    >
      <p>Submit your no-burn participation request for the current planting cycle.</p>
      <label>
        Planting cycle (optional)
        <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} disabled={submitting || loadingCycles}>
          <option value="">No cycle selected</option>
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.crop_name} / {cycle.season_year} ({cycle.status})
            </option>
          ))}
        </select>
      </label>
      <label>
        Request note (optional)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} disabled={submitting} />
      </label>
      {error ? <ErrorState title="No-burn request failed" detail={error} /> : null}
      {doneMessage ? <p>{doneMessage}</p> : null}
    </FormSheet>
  );
}
