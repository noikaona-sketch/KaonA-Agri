import { NextResponse } from 'next/server';
import { isForbidden, requireAdminPermission } from '../../_admin-auth';

export async function POST() {
  const permission = await requireAdminPermission('members.import');
  if (isForbidden(permission)) return permission.forbidden;

  // Scaffold placeholder only (Issue #297 phase 2):
  // - no create/update/delete operations yet
  // - no member approval automation
  // - TODO: write audit log when import execution is implemented
  return NextResponse.json(
    {
      ok: false,
      stage: 'confirm',
      message: 'Admin member import confirm endpoint is not implemented yet.',
      safeMode: true,
    },
    { status: 501 },
  );
}
