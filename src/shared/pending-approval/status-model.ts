export type PendingApprovalDomain = 'member_onboarding' | 'plot_registration' | 'field_verification' | 'no_burn_verification';

export type PendingApprovalStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_update';

export type PendingApprovalStatusMeta = {
  label: string;
  detail: string;
};

const statusMetaMap: Record<PendingApprovalStatus, PendingApprovalStatusMeta> = {
  draft: { label: 'Draft', detail: 'ข้อมูลยังไม่ถูกส่งเพื่อพิจารณา' },
  submitted: { label: 'Submitted', detail: 'ส่งคำขอแล้ว กำลังรอเจ้าหน้าที่รับเรื่อง' },
  under_review: { label: 'Under review', detail: 'เจ้าหน้าที่กำลังตรวจสอบข้อมูลและหลักฐาน' },
  approved: { label: 'Approved', detail: 'คำขอได้รับการอนุมัติแล้ว' },
  rejected: { label: 'Rejected', detail: 'คำขอไม่ผ่านการอนุมัติ' },
  needs_update: { label: 'Needs update', detail: 'ต้องแก้ไขข้อมูลก่อนส่งใหม่' },
};

const domainLabels: Record<PendingApprovalDomain, string> = {
  member_onboarding: 'Member onboarding',
  plot_registration: 'Plot registration',
  field_verification: 'Field verification',
  no_burn_verification: 'No-burn verification',
};

export function getPendingApprovalStatusMeta(status: PendingApprovalStatus): PendingApprovalStatusMeta {
  return statusMetaMap[status];
}

export function getPendingApprovalDomainLabel(domain: PendingApprovalDomain): string {
  return domainLabels[domain];
}
