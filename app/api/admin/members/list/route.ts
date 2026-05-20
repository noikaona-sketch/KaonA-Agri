import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdmin } from '../_admin-auth';
import { evaluateMemberReadiness } from '../readiness-policy';

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? '';
    const s = createServerSupabaseClient();

    let q = s.from('members').select(`
      id, full_name, phone, status, created_at,
      bank_name, bank_account_number, bank_verified_status,
      member_roles!inner(role, is_primary),
      plots!plots_member_id_fkey(id)
    `).order('created_at', { ascending: false }).limit(300);

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const members = ((data ?? []) as Record<string, unknown>[]).map((m) => {
      const roles = ((m.member_roles as { role: string; is_primary: boolean }[]) ?? []);
      const primary = roles.find((r) => r.is_primary)?.role ?? roles[0]?.role ?? null;
      const readiness = evaluateMemberReadiness({
        phone: (m.phone as string | null) ?? null,
        bank_name: (m.bank_name as string | null) ?? null,
        bank_account_number: (m.bank_account_number as string | null) ?? null,
        bank_verified_status: (m.bank_verified_status as string | null) ?? null,
        has_plots: ((m.plots as unknown[]) ?? []).length > 0,
        roles: roles.map((r) => r.role),
      });

      return {
        member_id:            m.id,
        full_name:            m.full_name,
        phone:                m.phone,
        status:               m.status,
        created_at:           m.created_at,
        bank_verified_status: m.bank_verified_status ?? 'missing',
        has_bank:             !!(m.bank_name && m.bank_account_number),
        has_plots:            ((m.plots as unknown[]) ?? []).length > 0,
        roles:                roles.map((r) => r.role),
        effective_role:       primary,
        readyToApprove:       readiness.readyToApprove,
        missingFields:        readiness.missingFields,
        readinessReason:      readiness.readinessReason,
      };
    });

    return NextResponse.json({ members });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
