'use client';

import { useEffect, useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember, useCurrentRoles } from '@/providers/auth-provider';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { PhotoUploadPlaceholder } from '@/shared/components/photo-upload-placeholder';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type PlantingCycleOption = {
  id: string;
  crop_type: string;
  season_year: number;
  status: string;
};

type WorkflowStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

type NoBurnRequestRow = {
  id: string;
  status: WorkflowStatus;
  submitted_at: string;
  created_at: string;
  reviewed_by: string | null;
  planting_cycle_id: string | null;
};

function toChipStatus(status: WorkflowStatus) {
  if (status === 'pending') return 'submitted' as const;
  if (status === 'reviewed') return 'under_review' as const;
  return status;
}

export function NoBurnParticipationWorkflow() {
  const member = useCurrentMember();
  const roles = useCurrentRoles();
  const isReviewer = useMemo(() => roles.includes('staff') || roles.includes('admin'), [roles]);

  const [cycles, setCycles] = useState<PlantingCycleOption[]>([]);
  const [requests, setRequests] = useState<NoBurnRequestRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  async function refreshData() {
    const supabase = createSupabaseBrowserClient();
    setLoading(true);
    setError(null);

    const [cycleResult, requestResult] = await Promise.all([
      supabase.from('planting_cycles').select('id, crop_type, season_year, status').order('created_at', { ascending: false }).limit(20),
      supabase.from('no_burn_requests').select('id, status, submitted_at, created_at, reviewed_by, planting_cycle_id').order('created_at', { ascending: false }).limit(20),
    ]);

    setLoading(false);

    if (cycleResult.error) return setError(cycleResult.error.message);
    if (requestResult.error) return setError(requestResult.error.message);

    setCycles((cycleResult.data ?? []) as PlantingCycleOption[]);
    setRequests((requestResult.data ?? []) as NoBurnRequestRow[]);
  }

  useEffect(() => {
    void refreshData();
  }, []);

  async function submitRequest() {
    setError(null);
    setDoneMessage(null);

    if (!member?.is_approved || member.status !== 'approved') return setError('Only approved members can submit no-burn participation requests.');
    if (!selectedCycleId) return setError('Please choose a planting cycle.');
    if (!agreementAccepted) return setError('Please accept the no-burn agreement before submission.');

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from('no_burn_requests').insert({
      planting_cycle_id: selectedCycleId,
      status: 'pending',
    });
    setSubmitting(false);

    if (insertError) return setError(insertError.message);

    setSelectedCycleId('');
    setAgreementAccepted(false);
    setDoneMessage('No-burn participation request submitted successfully.');
    await refreshData();
  }

  async function updateReviewStatus(requestId: string, nextStatus: 'reviewed' | 'approved' | 'rejected') {
    setError(null);
    setUpdatingReviewId(requestId);

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.from('no_burn_requests').update({ status: nextStatus }).eq('id', requestId);

    setUpdatingReviewId(null);
    if (updateError) return setError(updateError.message);

    await refreshData();
  }

  return (
    <FormSheet
      title="No-burn participation"
      footer={
        <UIButton onClick={submitRequest} loading={submitting} disabled={submitting || loading} fullWidth>
          Submit no-burn request
        </UIButton>
      }
    >
      <p>Submit no-burn participation by selecting a planting cycle, agreeing to the commitment, and attaching evidence photo.</p>
      <label>
        Planting cycle <strong>*</strong>
        <select value={selectedCycleId} onChange={(event) => setSelectedCycleId(event.target.value)} disabled={submitting || loading}>
          <option value="">Select planting cycle</option>
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.crop_type} / {cycle.season_year} ({cycle.status})
            </option>
          ))}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={agreementAccepted}
          onChange={(event) => setAgreementAccepted(event.target.checked)}
          disabled={submitting || loading}
        />{' '}
        I agree to participate in no-burn farming and allow inspection if required.
      </label>

      <PhotoUploadPlaceholder label="No-burn evidence photo" />

      <h4>Request status & timeline</h4>
      {requests.length === 0 ? <p>No no-burn requests yet.</p> : null}
      {requests.map((request) => (
        <div key={request.id}>
          <p>
            <strong>Request:</strong> {request.id.slice(0, 8)}...
          </p>
          <StatusChip status={toChipStatus(request.status)} />
          <p>Submitted: {new Date(request.submitted_at || request.created_at).toLocaleString()}</p>
          <p>Timeline: Pending → Reviewed → Approved/Rejected</p>
          {isReviewer ? (
            <div>
              <UIButton type="button" onClick={() => updateReviewStatus(request.id, 'reviewed')} disabled={updatingReviewId === request.id}>
                Mark reviewed
              </UIButton>{' '}
              <UIButton type="button" onClick={() => updateReviewStatus(request.id, 'approved')} disabled={updatingReviewId === request.id}>
                Approve
              </UIButton>{' '}
              <UIButton type="button" onClick={() => updateReviewStatus(request.id, 'rejected')} disabled={updatingReviewId === request.id}>
                Reject
              </UIButton>
            </div>
          ) : null}
        </div>
      ))}

      {error ? <ErrorState title="No-burn request failed" detail={error} /> : null}
      {doneMessage ? <p>{doneMessage}</p> : null}
    </FormSheet>
  );
}
