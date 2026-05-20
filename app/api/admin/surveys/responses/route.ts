import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../../members/_admin-auth';

export async function GET() {
  const auth = await requireAdminPermission('field.read');
  if (isForbidden(auth)) return auth.forbidden;

  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('survey_responses')
    .select('id,submitted_at,surveys(title),members(full_name,phone)')
    .order('submitted_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
