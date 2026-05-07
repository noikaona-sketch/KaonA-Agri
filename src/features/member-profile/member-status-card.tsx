import type { AppRole, MemberStatus } from '@/shared/auth/auth-types';
import { InfoCard } from '@/shared/components/info-card';
import { RoleBadge } from '@/shared/components/role-badge';

import { MEMBER_STATUS_LABELS_TH, ROLE_LABELS_TH } from './member-profile-labels';

type MemberStatusCardProps = {
  status: MemberStatus;
  effectiveRole: AppRole | null;
  roles: AppRole[];
};

export function MemberStatusCard({ status, effectiveRole, roles }: MemberStatusCardProps) {
  return (
    <InfoCard
      title="สถานะสมาชิก"
      subtitle={`สถานะปัจจุบัน: ${MEMBER_STATUS_LABELS_TH[status]}`}
      meta={<RoleBadge>{effectiveRole ? ROLE_LABELS_TH[effectiveRole] : 'ยังไม่กำหนดบทบาท'}</RoleBadge>}
      action={
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          บทบาทที่ได้รับ: {roles.length > 0 ? roles.map((role) => ROLE_LABELS_TH[role]).join(', ') : 'ยังไม่มีบทบาท'}
        </p>
      }
    />
  );
}
