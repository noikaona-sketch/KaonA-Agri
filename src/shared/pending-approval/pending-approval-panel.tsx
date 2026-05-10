import { StatusChip } from '@/shared/components/status-chip';

import {
  getPendingApprovalDomainLabel,
  getPendingApprovalStatusMeta,
  type PendingApprovalDomain,
  type PendingApprovalStatus,
} from './status-model';

type PendingApprovalPanelProps = {
  domain: PendingApprovalDomain;
  status: PendingApprovalStatus;
};

export function PendingApprovalPanel({ domain, status }: PendingApprovalPanelProps) {
  const domainLabel = getPendingApprovalDomainLabel(domain);
  const statusMeta = getPendingApprovalStatusMeta(status);

  return (
    <article style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{domainLabel}</p>
      <h3 style={{ marginTop: 6, marginBottom: 8 }}>{statusMeta.label}</h3>
      <StatusChip status={status} />
      <p style={{ marginBottom: 0 }}>{statusMeta.detail}</p>
    </article>
  );
}
