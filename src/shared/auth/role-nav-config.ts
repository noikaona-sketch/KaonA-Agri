import type { AppRole, AuthStatus } from '@/shared/auth/auth-types';

export type NavIconKey = 'member' | 'service' | 'field' | 'admin' | string;

export type NavTab = {
  label: string;
  href: string;
  iconKey: NavIconKey;
  color?: string;
  activeBg?: string;
};

export type RoleNavConfig = {
  tabs: readonly NavTab[];
};

// ยังไม่มี member — สมัครสมาชิก
const GUEST_NAV: RoleNavConfig = {
  tabs: [
    { label: 'สมัครสมาชิก', href: '/register',             iconKey: 'member'  },
    { label: 'มี PIN',       href: '/register?tab=pin',     iconKey: 'field'   },
    { label: 'ติดต่อแอดมิน', href: '/contact', iconKey: 'service' },
    { label: 'เกี่ยวกับ',   href: '/register?tab=about',   iconKey: 'admin'   },
  ],
};

// pending / rejected / suspended — ดูสถานะ + แก้ไข
const PENDING_NAV: RoleNavConfig = {
  tabs: [
    { label: 'สถานะ',        href: '/',                     iconKey: 'member'  },
    { label: 'แก้ไขข้อมูล', href: '/register?tab=edit',    iconKey: 'field'   },
    { label: 'ติดต่อแอดมิน', href: '/contact', iconKey: 'service' },
    { label: 'โปรไฟล์',     href: '/profile',              iconKey: 'admin'   },
  ],
};

const ROLE_NAV_MAP: Record<AppRole, RoleNavConfig> = {
  farmer: {
    tabs: [
      { label: 'หน้าแรก',        href: '/',                     iconKey: '🏠', color: '#2E7D32', activeBg: '#EAF7E7' },
      { label: 'แปลงของฉัน',    href: '/plots',                iconKey: '🗺️', color: '#2E7D32', activeBg: '#EAF7E7' },
      { label: 'จองเมล็ดพันธุ์', href: '/service/reservations', iconKey: '🌱', color: '#EA580C', activeBg: '#FFF0E3' },
      { label: 'ไม่เผา',         href: '/no-burn',              iconKey: '🌿', color: '#7C3AED', activeBg: '#F3ECFF' },
      { label: 'โปรไฟล์',        href: '/profile',              iconKey: '👤', color: '#2563EB', activeBg: '#EAF2FF' },
    ],
  },
  leader: {
    tabs: [
      { label: 'หน้าแรก',   href: '/',                     iconKey: '🏠' },
      { label: 'งาน/แจ้งเตือน', href: '/notifications', iconKey: '📋' },
      { label: 'แบบสำรวจ', href: '/member/surveys', iconKey: '📝' },
      { label: 'โปรไฟล์',  href: '/profile',              iconKey: '👤' },
    ],
  },
  inspector: {
    tabs: [
      { label: 'งานตรวจ',   href: '/inspection/tasks',  iconKey: '🔍', color: '#534AB7', activeBg: '#EEEDFE' },
      { label: 'ภาคสนาม',  href: '/field',              iconKey: '🗺️', color: '#2E7D32', activeBg: '#EAF7E7' },
      { label: 'แจ้งเตือน', href: '/notifications',      iconKey: '📋' },
      { label: 'โปรไฟล์',  href: '/profile',             iconKey: '👤' },
    ],
  },
  truck_owner: {
    tabs: [
      { label: 'หน้าแรก',   href: '/',                     iconKey: '🏠' },
      { label: 'งาน/แจ้งเตือน', href: '/notifications', iconKey: '📋' },
      { label: 'แบบสำรวจ', href: '/member/surveys', iconKey: '📝' },
      { label: 'โปรไฟล์',  href: '/profile',              iconKey: '👤' },
    ],
  },
  staff: {
    tabs: [
      { label: 'หน้าแรก',  href: '/',                iconKey: '🏠' },
      { label: 'ภาคสนาม', href: '/field',            iconKey: '🗺️', color: '#2E7D32', activeBg: '#EAF7E7' },
      { label: 'แจ้งเตือน', href: '/notifications',  iconKey: '📋' },
      { label: 'โปรไฟล์',  href: '/profile',         iconKey: '👤' },
    ],
  },
  admin: {
    tabs: [
      { label: 'หน้าแรก',   href: '/',                     iconKey: '🏠' },
      { label: 'งาน/แจ้งเตือน', href: '/notifications', iconKey: '📋' },
      { label: 'แบบสำรวจ', href: '/member/surveys', iconKey: '📝' },
      { label: 'โปรไฟล์',  href: '/profile',              iconKey: '👤' },
    ],
  },
};

const FALLBACK_NAV: RoleNavConfig = GUEST_NAV;

export function getNavConfigForRole(role: AppRole | null): RoleNavConfig {
  if (!role) return GUEST_NAV;
  return ROLE_NAV_MAP[role] ?? GUEST_NAV;
}

// ใช้ทั้ง status + role เพื่อได้ nav ที่ถูกต้อง
export function getNavConfig(status: AuthStatus, role: AppRole | null, pathname?: string): RoleNavConfig {
  // ถ้าอยู่หน้า /register → ใช้ nav พิเศษเสมอ ไม่ว่า status จะเป็นอะไร
  if (pathname?.startsWith('/register')) {
    if (status === 'pending_approval' || status === 'rejected' || status === 'suspended') {
      return PENDING_NAV;
    }
    return GUEST_NAV;
  }
  if (status === 'loading' || status === 'unauthenticated' || status === 'no_member' || status === 'error') {
    return GUEST_NAV;
  }
  if (status === 'pending_approval' || status === 'rejected' || status === 'suspended' || status === 'access_denied') {
    return PENDING_NAV;
  }
  // approved
  return getNavConfigForRole(role);
}
