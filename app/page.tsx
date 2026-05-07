import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import {
  UIButton,
  EmptyState,
  ErrorState,
  InfoCard,
  LoadingState,
  SectionHeader,
  StatusChip,
} from '@/shared/components/ui-primitives';

const mockMembers = [
  { id: 'M-1045', name: 'Anan Chai', phone: '081-204-1144', status: 'Approved' },
  { id: 'M-1078', name: 'Suda Klang', phone: '086-330-6210', status: 'Pending' },
  { id: 'M-1124', name: 'Preecha Dam', phone: '093-884-2009', status: 'Suspended' },
];

export default function HomePage() {
  return (
    <ProtectedRoute>
      <MobileAppShell title="Members" subtitle="Manage approvals and status changes.">
        <section className="members-summary-grid">
          <InfoCard title="Total Members" value="1,248" />
          <InfoCard title="Pending Review" value="38" />
          <InfoCard title="Suspended" value="12" />
        </section>

        <SectionHeader title="Member Directory" action={<UIButton variant="secondary">Add Member</UIButton>} />

        <section className="members-list">
          {mockMembers.map((member) => (
            <article key={member.id} className="member-row">
              <div>
                <p className="member-row__name">{member.name}</p>
                <p className="member-row__meta">
                  {member.id} • {member.phone}
                </p>
              </div>
              <StatusChip label={member.status} />
            </article>
          ))}
        </section>

        <SectionHeader title="States" />
        <div className="members-states">
          <LoadingState message="Loading members…" />
          <ErrorState message="Could not fetch members right now." />
          <EmptyState message="No members match the selected filters." />
        </div>
      </MobileAppShell>
    </ProtectedRoute>
  );
}
