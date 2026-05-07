import { EmptyState } from '@/shared/components/empty-state';
import { InfoCard } from '@/shared/components/info-card';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProgressBadge } from '@/shared/components/progress-badge';
import { SectionHeader } from '@/shared/components/section-header';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';
import { ProtectedRoute } from '@/shared/components/protected-route';

type MemberApprovalItem = {
  id: string;
  fullName: string;
  citizenIdMasked: string;
  village: string;
  requestedAt: string;
  requestedBy: 'self' | 'leader';
};

// UI-only mock data. Replace with Supabase query in a later issue.
const pendingMemberApprovals: MemberApprovalItem[] = [
  {
    id: 'APP-240521-001',
    fullName: 'Nattapon S.',
    citizenIdMasked: '1-2345-XXXXX-12-3',
    village: 'Ban Nong Khun',
    requestedAt: '2026-05-06 08:15',
    requestedBy: 'self',
  },
  {
    id: 'APP-240521-002',
    fullName: 'Siriporn T.',
    citizenIdMasked: '1-9584-XXXXX-44-8',
    village: 'Ban Na Klang',
    requestedAt: '2026-05-06 09:44',
    requestedBy: 'leader',
  },
  {
    id: 'APP-240521-003',
    fullName: 'Wichai K.',
    citizenIdMasked: '3-1048-XXXXX-99-6',
    village: 'Ban Huai Sai',
    requestedAt: '2026-05-06 13:21',
    requestedBy: 'self',
  },
];

export default function AdminMembersPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'staff']}>
      <MobileAppShell
        title="Admin approval queue"
        subtitle="Review pending member onboarding requests"
        roleBadge="Admin/Staff"
      >
        <SectionHeader
          title="Member onboarding approvals"
          subtitle="UI mock for Issue #29 — approval actions are disabled."
          action={<ProgressBadge current={pendingMemberApprovals.length} total={20} />}
        />

        {pendingMemberApprovals.length === 0 ? (
          <EmptyState
            title="Approval queue is clear"
            detail="No pending member onboarding requests at this time."
          />
        ) : (
          pendingMemberApprovals.map((approval) => (
            <InfoCard
              key={approval.id}
              title={approval.fullName}
              subtitle={`${approval.village} • ${approval.citizenIdMasked} • ${approval.requestedAt} • ${approval.requestedBy === 'leader' ? 'Leader submitted' : 'Self submitted'}`}
              meta={<StatusChip status="submitted" />}
              action={
                <div style={{ display: 'grid', gap: 8 }}>
                  <UIButton fullWidth variant="secondary" disabled title="Mock action only">
                    Reject (Mock)
                  </UIButton>
                  <UIButton fullWidth disabled title="Mock action only">
                    Approve (Mock)
                  </UIButton>
                </div>
              }
            />
          ))
        )}
      </MobileAppShell>
    </ProtectedRoute>
  );
}
