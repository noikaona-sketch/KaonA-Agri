import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

const DAYS_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];

export async function GET() {
  const _ar = await requireAdminPermission('service.read');
  if (isForbidden(_ar)) return _ar.forbidden;
  const s = createServerSupabaseClient();
  const [tmplRes, locRes] = await Promise.all([
    s.from('intake_quota_templates')
      .select('id,location_id,day_of_week,default_capacity_kg_dryer,default_capacity_kg_dry,default_time,is_active')
      .order('location_id').order('day_of_week'),
    s.from('pickup_locations').select('id,name').eq('active', true),
  ]);
  return NextResponse.json({
    templates:  (tmplRes.data ?? []).map((t) => ({ ...t, day_label: DAYS_TH[t.day_of_week] })),
    locations:  locRes.data ?? [],
  });
}

export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('service.write');
    if (isForbidden(_ar)) return _ar.forbidden;
    const body = (await request.json()) as {
      location_id: string; day_of_week: number;
      default_capacity_kg_dryer: number; default_capacity_kg_dry: number;
      default_time?: string;
    };
    const { error } = await createServerSupabaseClient()
      .from('intake_quota_templates').upsert({
        location_id:                body.location_id,
        day_of_week:                body.day_of_week,
        default_capacity_kg_dryer:  body.default_capacity_kg_dryer,
        default_capacity_kg_dry:    body.default_capacity_kg_dry,
        default_time:               body.default_time ?? '07:00-17:00',
        is_active:                  true,
      }, { onConflict: 'location_id,day_of_week' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
