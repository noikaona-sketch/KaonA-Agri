// GET /api/admin/me — returns current admin identity + role + permissions
// Used by AdminWebShell to filter menu and guard pages client-side
// Server-side guards in PR4 for API mutations

import { NextResponse } from 'next/server';
import { requireAdmin } from '../members/_admin-auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    adminUserId:   admin.adminUserId,
    email:         admin.email,
    department:    admin.department,
    adminRole:     admin.adminRole,
    permissions:   admin.permissions,
  });
}
