import type { AppRole, AuthStatus } from '@/shared/auth/auth-types';

export type NavIconKey = 'member' | 'service' | 'field' | 'admin' | string;

export type NavTab = {
  label   : string;
  href    : string;
  iconKey : NavIconKey;
  color?  : string;
  activeBg?: string;
};

export type RoleNavConfig = {
  tabs: readonly NavTab[];
};

// ─── Primary role definitions ─────────────────────────────────────────────────

const PRIMARY_ROLES = new Set<AppRole>(['farmer','staff','truck_owner','admin']);
const SUB_ROLES     = new Set<AppRole>(['inspector','leader']);

// ─── Base tabs per PRIMARY role ───────────────────────────────────────────────

const FARMER_TABS: NavTab[] = [
  { label: 'หน้าแรก',        href: '/',                     iconKey: '🏠', color: '#2E7D32', activeBg: '#EAF7E7' },
  { label: 'แปลงของฉัน',    href: '/plots',                iconKey: '🗺️', color: '#2E7D32', activeBg: '#EAF7E7' },
  { label: 'จองเมล็ดพันธุ์', href: '/service/reservations', iconKey: '🌱', color: '#EA580C', activeBg: '#FFF0E3' },
  { label: 'ไม่เผา',         href: '/no-burn',              iconKey: '🌿', color: '#7C3AED', activeBg: '#F3ECFF' },
  { label: 'โปรไฟล์',        href: '/profile',              iconKey: '👤', color: '#2563EB', activeBg: '#EAF2FF' },
];

const STAFF_TABS: NavTab[] = [
  { label: 'หน้าแรก',   href: '/',             iconKey: '🏠' },
  { label: 'ภาคสนาม',  href: '/field',         iconKey: '🗺️', color: '#2E7D32', activeBg: '#EAF7E7' },
  { label: 'แจ้งเตือน', href: '/notifications', iconKey: '📋' },
  { label: 'โปรไฟล์',  href: '/profile',       iconKey: '👤' },
];

const TRUCK_TABS: NavTab[] = [
  { label: 'หน้าแรก',   href: '/',             iconKey: '🏠' },
  { label: 'งานรถ',     href: '/truck',         iconKey: '🚛', color: '#B45309', activeBg: '#FEF3C7' },
  { label: 'แจ้งเตือน', href: '/notifications', iconKey: '📋' },
  { label: 'โปรไฟล์',  href: '/profile',       iconKey: '👤' },
];

const ADMIN_TABS: NavTab[] = [
  { label: 'แดชบอร์ด',  href: '/admin',         iconKey: '📊', color: '#1D4ED8', activeBg: '#EFF6FF' },
  { label: 'สมาชิก',    href: '/admin/members', iconKey: '👥', color: '#1D4ED8', activeBg: '#EFF6FF' },
  { label: 'แจ้งเตือน', href: '/notifications', iconKey: '📋' },
  { label: 'โปรไฟล์',  href: '/profile',        iconKey: '👤' },
];

// ─── Sub role extra tabs ───────────────────────────────────────────────────────

const INSPECTOR_TAB: NavTab = {
  label: 'งานตรวจ', href: '/inspection/tasks',
  iconKey: '🔍', color: '#534AB7', activeBg: '#EEEDFE',
};

const LEADER_TAB: NavTab = {
  label: 'กลุ่มของฉัน', href: '/leader',
  iconKey: '👨‍👩‍👧', color: '#0369A1', activeBg: '#E0F2FE',
};

// ─── Guest / Pending ──────────────────────────────────────────────────────────

const GUEST_NAV: RoleNavConfig = {
  tabs: [
    { label: 'สมัครสมาชิก',  href: '/register',          iconKey: 'member'  },
    { label: 'มี PIN',        href: '/register?tab=pin',  iconKey: 'field'   },
    { label: 'ติดต่อแอดมิน', href: '/contact',            iconKey: 'service' },
    { label: 'เกี่ยวกับ',    href: '/register?tab=about', iconKey: 'admin'   },
  ],
};

const PENDING_NAV: RoleNavConfig = {
  tabs: [
    { label: 'สถานะ',        href: '/',                  iconKey: 'member'  },
    { label: 'แก้ไขข้อมูล', href: '/register?tab=edit', iconKey: 'field'   },
    { label: 'ติดต่อแอดมิน', href: '/contact',            iconKey: 'service' },
    { label: 'โปรไฟล์',     href: '/profile',            iconKey: 'admin'   },
  ],
};

// ─── Main nav builder ─────────────────────────────────────────────────────────

function buildTabs(primaryRole: AppRole, allRoles: AppRole[]): readonly NavTab[] {
  // Base tabs จาก primary role
  let base: NavTab[];
  switch (primaryRole) {
    case 'farmer':     base = [...FARMER_TABS]; break;
    case 'staff':      base = [...STAFF_TABS];  break;
    case 'truck_owner':base = [...TRUCK_TABS];  break;
    case 'admin':      base = [...ADMIN_TABS];  break;
    default:           base = [...FARMER_TABS]; break;
  }

  const hasSub = (r: AppRole) => allRoles.includes(r);

  // เพิ่ม inspector tab (ก่อน โปรไฟล์)
  if (hasSub('inspector')) {
    const profileIdx = base.findIndex((t) => t.href === '/profile');
    if (profileIdx >= 0) {
      base.splice(profileIdx, 0, INSPECTOR_TAB);
    } else {
      base.push(INSPECTOR_TAB);
    }
  }

  // เพิ่ม leader tab (ก่อน โปรไฟล์ และ inspector)
  if (hasSub('leader')) {
    const profileIdx = base.findIndex((t) => t.href === '/profile');
    const insertAt   = profileIdx >= 0 ? profileIdx : base.length;
    // inspector แทรกก่อน → leader แทรกก่อน inspector
    const inspectorIdx = base.findIndex((t) => t.href === '/inspection/tasks');
    const finalIdx     = inspectorIdx >= 0 ? inspectorIdx : insertAt;
    base.splice(finalIdx, 0, LEADER_TAB);
  }

  // จำกัด max 5 tabs บน mobile
  return base.slice(0, 5);
}

export function getNavConfigForRole(role: AppRole | null): RoleNavConfig {
  if (!role) return GUEST_NAV;
  return { tabs: buildTabs(role, [role]) };
}

export function getNavConfig(
  status   : AuthStatus,
  role     : AppRole | null,
  pathname?: string,
  allRoles?: AppRole[],
): RoleNavConfig {
  if (pathname?.startsWith('/register')) {
    if (status === 'pending_approval' || status === 'rejected' || status === 'suspended') return PENDING_NAV;
    return GUEST_NAV;
  }
  if (
    status === 'loading' || status === 'unauthenticated' ||
    status === 'no_member' || status === 'error'
  ) return GUEST_NAV;

  if (
    status === 'pending_approval' || status === 'rejected' ||
    status === 'suspended' || status === 'access_denied'
  ) return PENDING_NAV;

  if (!role) return GUEST_NAV;

  const roles = allRoles ?? [role];
  return { tabs: buildTabs(role, roles) };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/** primary roles ที่ห้ามอยู่ด้วยกัน */
const CONFLICTING_PRIMARIES: AppRole[][] = [
  ['farmer', 'staff'],
  ['farmer', 'truck_owner'],
  ['staff',  'truck_owner'],
];

export function canAddRole(existingRoles: AppRole[], newRole: AppRole): { ok: boolean; reason?: string } {
  if (SUB_ROLES.has(newRole)) {
    // sub role ต้องมี primary ก่อน
    const hasPrimary = existingRoles.some((r) => PRIMARY_ROLES.has(r));
    if (!hasPrimary) return { ok: false, reason: `ต้องมี role หลักก่อน (farmer/staff/truck_owner/admin)` };
    return { ok: true };
  }

  if (PRIMARY_ROLES.has(newRole)) {
    for (const conflict of CONFLICTING_PRIMARIES) {
      if (conflict.includes(newRole) && existingRoles.some((r) => conflict.includes(r) && r !== newRole)) {
        return { ok: false, reason: `${newRole} ขัดแย้งกับ role ที่มีอยู่` };
      }
    }
  }

  return { ok: true };
}

export { PRIMARY_ROLES, SUB_ROLES };
