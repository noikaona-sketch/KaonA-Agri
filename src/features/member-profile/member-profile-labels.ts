import type { AppRole, MemberStatus } from '@/shared/auth/auth-types';

export const ROLE_LABELS_TH: Record<AppRole, string> = {
  farmer: 'เกษตรกร',
  leader: 'ผู้นำชุมชน',
  inspector: 'ผู้ตรวจสอบ',
  truck_owner: 'เจ้าของรถขนส่ง',
  staff: 'พนักงาน',
  admin: 'ผู้ดูแลระบบ',
};

export const MEMBER_STATUS_LABELS_TH: Record<MemberStatus, string> = {
  pending:          'รออนุมัติ',
  pending_approval: 'รออนุมัติ',
  returned:         'ส่งกลับแก้ไข',
  approved:         'อนุมัติแล้ว',
  rejected:         'ไม่อนุมัติ',
  suspended:        'ระงับการใช้งาน',
};
