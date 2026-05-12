import type { AppRole, AuthStatus } from '@/shared/auth/auth-types';

export type NavIconKey = 'member' | 'service' | 'field' | 'admin';

export type NavTab = {
  label: string;
  href: string;
  iconKey: NavIconKey;
};

export type RoleNavConfig = {
  tabs: readonly [NavTab, NavTab, NavTab, NavTab];
};

// ยังไม่มี role — สมัครสมาชิก / บริการ
const GUEST_NAV: RoleNavConfig = {
  tabs: [
    { label: 'หน้าหลัก',     href: '/',         iconKey: 'member'  },
    { label: 'สมัครสมาชิก', href: '/register',  iconKey: 'field'   },
    { label: 'บริการ',       href: '/register?tab=pin', iconKey: 'service' },
    { label: 'โปรไฟล์',     href: '/profile',   iconKey: 'admin'   },
  ],
};

// pending / rejected / suspended — จำกัดเมนู
const PENDING_NAV: RoleNavConfig = {
  tabs: [
    { label: 'หน้าหลัก',  href: '/',        iconKey: 'member'  },
    { label: 'สถานะ',     href: '/',        iconKey: 'field'   },
    { label: 'บริการ',    href: '/register?tab=pin', iconKey: 'service' },
    { label: 'โปรไฟล์',  href: '/profile', iconKey: 'admin'   },
  ],
};

const ROLE_NAV_MAP: Record<AppRole, RoleNavConfig> = {
  farmer: {
    tabs: [
      { label: 'หน้าหลัก', href: '/', iconKey: 'member' },
      { label: 'แปลงของฉัน', href: '/plots', iconKey: 'field' },
      { label: 'งดเผา', href: '/no-burn', iconKey: 'service' },
      { label: 'โปรไฟล์', href: '/profile', iconKey: 'admin' },
    ],
  },
  leader: {
    tabs: [
      { label: 'หน้าหลัก', href: '/', iconKey: 'member' },
      { label: 'ทีมของฉัน', href: '/member', iconKey: 'field' },
      { label: 'บันทึก', href: '/plots', iconKey: 'service' },
      { label: 'โปรไฟล์', href: '/profile', iconKey: 'admin' },
    ],
  },
  inspector: {
    tabs: [
      { label: 'หน้าหลัก', href: '/', iconKey: 'member' },
      { label: 'งานตรวจ', href: '/inspection/tasks', iconKey: 'field' },
      { label: 'บันทึก', href: '/plots', iconKey: 'service' },
      { label: 'โปรไฟล์', href: '/profile', iconKey: 'admin' },
    ],
  },
  truck_owner: {
    tabs: [
      { label: 'หน้าหลัก', href: '/', iconKey: 'member' },
      { label: 'งานขนส่ง', href: '/service', iconKey: 'field' },
      { label: 'งดเผา', href: '/no-burn', iconKey: 'service' },
      { label: 'โปรไฟล์', href: '/profile', iconKey: 'admin' },
    ],
  },
  staff: {
    tabs: [
      { label: 'หน้าหลัก', href: '/', iconKey: 'member' },
      { label: 'อนุมัติ', href: '/admin/members', iconKey: 'field' },
      { label: 'ภาคสนาม', href: '/field', iconKey: 'service' },
      { label: 'โปรไฟล์', href: '/profile', iconKey: 'admin' },
    ],
  },
  admin: {
    tabs: [
      { label: 'หน้าหลัก', href: '/', iconKey: 'member' },
      { label: 'อนุมัติ', href: '/admin/members', iconKey: 'field' },
      { label: 'จัดการ', href: '/admin-prototype', iconKey: 'service' },
      { label: 'โปรไฟล์', href: '/profile', iconKey: 'admin' },
    ],
  },
};

const FALLBACK_NAV: RoleNavConfig = GUEST_NAV;

export function getNavConfigForRole(role: AppRole | null): RoleNavConfig {
  if (!role) return GUEST_NAV;
  return ROLE_NAV_MAP[role] ?? GUEST_NAV;
}

// ใช้ทั้ง status + role เพื่อได้ nav ที่ถูกต้อง
export function getNavConfig(status: AuthStatus, role: AppRole | null): RoleNavConfig {
  if (status === 'loading' || status === 'unauthenticated' || status === 'no_member' || status === 'error') {
    return GUEST_NAV;
  }
  if (status === 'pending_approval' || status === 'rejected' || status === 'suspended' || status === 'access_denied') {
    return PENDING_NAV;
  }
  // approved
  return getNavConfigForRole(role);
}
