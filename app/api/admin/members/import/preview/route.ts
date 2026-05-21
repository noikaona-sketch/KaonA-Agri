import { NextResponse } from 'next/server';
import { isForbidden, requireAdminPermission } from '../../_admin-auth';

export async function POST() {
  const permission = await requireAdminPermission('members.import');
  if (isForbidden(permission)) return permission.forbidden;

  // Scaffold placeholder only (Issue #297 phase 2):
  // - no file parsing yet
  // - no validation engine yet
  // - no database import yet
  // - audit logging will be added with real execution logic
  return NextResponse.json(
    {
      ok: false,
      stage: 'preview',
      message: 'Admin member import preview endpoint is not implemented yet.',
      safeMode: true,
    },
    { status: 501 },
  );
}
