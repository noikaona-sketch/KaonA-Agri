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

// ยังไม่มี member — สมัครสมาชิก
const GUEST_NAV: RoleNavConfig = {
  tabs: [
    { label: 'สมัครสมาชิก', href: '/register',             iconKey: 'member'  },
    { label: 'มี PIN',       href: '/register?tab=pin',     iconKey: 'field'   },
    { label: 'ติดต่อ admin', href: '/register?tab=contact', iconKey: 'service' },
    { label: 'เกี่ยวกับ',   href: '/register?tab=about',   iconKey: 'admin'   },
  ],
};

// pending / rejected / suspended — ดูสถานะ + แก้ไข
const PENDING_NAV: RoleNavConfig = {
  tabs: [
    { label: 'สถานะ',        href: '/',                     iconKey: 'member'  },
    { label: 'แก้ไขข้อมูล', href: '/register?tab=edit',    iconKey: 'field'   },
    { label: 'ติดต่อ admin', href: '/register?tab=contact', iconKey: 'service' },
    { label: 'โปรไฟล์',     href: '/profile',              iconKey: 'admin'   },
  ],
};

const ROLE_NAV_MAP: Record<AppRole, RoleNavConfig> = {
  farmer: {
    tabs: [
      { label: 'หน้าหลัก',    href: '/',                  iconKey: 'member'  },
      { label: 'แปลง',        href: '/plots',             iconKey: 'field'   },
      { label: 'รอบปลูก',     href: '/planting-cycles',   iconKey: 'service' },
      { label: 'โปรไฟล์',    href: '/profile',            iconKey: 'admin'   },
    ],
  },
  leader: {
    tabs: [
      { label: 'หน้าหลัก',  href: '/',                iconKey: 'member'  },
      { label: 'ทีมของฉัน', href: '/team',            iconKey: 'field'   },
      { label: 'รอบปลูก',   href: '/planting-cycles', iconKey: 'service' },
      { label: 'โปรไฟล์',  href: '/profile',          iconKey: 'admin'   },
    ],
  },
  inspector: {
    tabs: [
      { label: 'หน้าหลัก', href: '/', iconKey: 'member' },
      { label: 'งานตรวจ', href: '/inspection/tasks', iconKey: 'field' },
      { label: 'ภาคสนาม', href: '/field',            iconKey: 'service' },
      { label: 'โปรไฟล์', href: '/profile',          iconKey: 'admin' },
    ],
  },
  truck_owner: {
    tabs: [
      { label: 'หน้าหลัก',   href: '/',        iconKey: 'member'  },
      { label: 'งานรถเกี่ยว', href: '/truck',   iconKey: 'field'   },
      { label: 'งดเผา',      href: '/no-burn', iconKey: 'service' },
      { label: 'โปรไฟล์',   href: '/profile', iconKey: 'admin'   },
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
