import type { AppRole } from '@/shared/auth/auth-types';

export type NavIconKey = 'member' | 'service' | 'field' | 'admin';

export type NavTab = {
  label: string;
  href: string;
  iconKey: NavIconKey;
};

export type RoleNavConfig = {
  tabs: readonly [NavTab, NavTab, NavTab, NavTab];
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

const FALLBACK_NAV: RoleNavConfig = {
  tabs: [
    { label: 'หน้าหลัก', href: '/', iconKey: 'member' },
    { label: 'สมัครสมาชิก', href: '/member/register', iconKey: 'field' },
    { label: 'บริการ', href: '/service', iconKey: 'service' },
    { label: 'โปรไฟล์', href: '/profile', iconKey: 'admin' },
  ],
};

export function getNavConfigForRole(role: AppRole | null): RoleNavConfig {
  if (!role) return FALLBACK_NAV;
  return ROLE_NAV_MAP[role] ?? FALLBACK_NAV;
}
