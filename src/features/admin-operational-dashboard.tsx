'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { InfoCard } from '@/shared/components/info-card';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type DashboardMetrics = {
  pendingMemberApprovals: number;
  pendingNoBurnRequests: number;
};

const INITIAL_METRICS: DashboardMetrics = {
  pendingMemberApprovals: 0,
  pendingNoBurnRequests: 0,
};

export function AdminOperationalDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMetrics() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const [memberApprovalsResult, noBurnRequestsResult] = await Promise.all([
      supabase
        .from('approvals')
        .select('id', { count: 'exact', head: true })
        .eq('resource_type', 'member')
        .eq('status', 'pending'),
      supabase
        .from('no_burn_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['requested', 'under_review'])
        .is('deleted_at', null),
    ]);

    if (memberApprovalsResult.error || noBurnRequestsResult.error) {
      setError(memberApprovalsResult.error?.message ?? noBurnRequestsResult.error?.message ?? 'Unknown error');
      setLoading(false);
      return;
    }

    setMetrics({
      pendingMemberApprovals: memberApprovalsResult.count ?? 0,
      pendingNoBurnRequests: noBurnRequestsResult.count ?? 0,
    });
    setLoading(false);
  }

  useEffect(() => {
    void loadMetrics();
  }, []);

  return (
    <FormSheet
      title="Operations dashboard"
      footer={
        <UIButton variant="secondary" onClick={() => void loadMetrics()} loading={loading}>
          Refresh metrics
        </UIButton>
      }
    >
      {error ? <ErrorState title="Dashboard load failed" detail={error} /> : null}

      <InfoCard
        title="Member onboarding queue"
        subtitle={loading ? 'Loading pending approvals…' : `${metrics.pendingMemberApprovals} pending approvals`}
        meta={<StatusChip status={metrics.pendingMemberApprovals > 0 ? 'under_review' : 'approved'} />}
        action={<Link href="/admin/members">Open member approvals</Link>}
      />

      <InfoCard
        title="No-burn review queue"
        subtitle={loading ? 'Loading pending requests…' : `${metrics.pendingNoBurnRequests} pending requests`}
        meta={<StatusChip status={metrics.pendingNoBurnRequests > 0 ? 'under_review' : 'approved'} />}
        action={<p>Review flow integration is next. Queue visibility is enabled in this MVP.</p>}
      />
    </FormSheet>
  );
}
