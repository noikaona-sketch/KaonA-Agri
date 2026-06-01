import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/no-burn/seasons
export async function GET(request: Request) {
  const auth = await requireAdminPermission('field.read');
  if (isForbidden(auth)) return auth.forbidden;

  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('no_burn_seasons')
    .select('id,name,season_year,starts_at,ends_at,crop_type,bonus_type,bonus_value,is_active,note,created_at')
    .order('starts_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seasons: data ?? [] });
}

type SeasonPayload = {
  id?          : string;
  name         : string;
  season_year  : number;
  starts_at    : string;
  ends_at      : string;
  crop_type?   : string | null;
  bonus_type   : 'per_ton' | 'per_rai';
  bonus_value  : number;
  is_active?   : boolean;
  note?        : string | null;
};

// POST /api/admin/no-burn/seasons — สร้างรอบใหม่
export async function POST(request: Request) {
  const auth = await requireAdminPermission('field.write');
  if (isForbidden(auth)) return auth.forbidden;

  const body = (await request.json()) as SeasonPayload;
  if (!body.name?.trim() || !body.starts_at || !body.ends_at) {
    return NextResponse.json({ error: 'name, starts_at, ends_at จำเป็น' }, { status: 400 });
  }
  if (!['per_ton', 'per_rai'].includes(body.bonus_type)) {
    return NextResponse.json({ error: 'bonus_type ต้องเป็น per_ton หรือ per_rai' }, { status: 400 });
  }
  if (body.bonus_value < 0) {
    return NextResponse.json({ error: 'bonus_value ต้องไม่ติดลบ' }, { status: 400 });
  }

  const s = createServerSupabaseClient();
  const { data, error } = await s.from('no_burn_seasons').insert({
    name: body.name.trim(), season_year: body.season_year,
    starts_at: body.starts_at, ends_at: body.ends_at,
    crop_type: body.crop_type ?? null,
    bonus_type: body.bonus_type, bonus_value: body.bonus_value,
    is_active: body.is_active ?? true,
    note: body.note ?? null,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

// PATCH /api/admin/no-burn/seasons — แก้ไขรอบ
export async function PATCH(request: Request) {
  const auth = await requireAdminPermission('field.write');
  if (isForbidden(auth)) return auth.forbidden;

  const body = (await request.json()) as SeasonPayload;
  if (!body.id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 });

  const s = createServerSupabaseClient();
  const { error } = await s.from('no_burn_seasons').update({
    name: body.name.trim(), season_year: body.season_year,
    starts_at: body.starts_at, ends_at: body.ends_at,
    crop_type: body.crop_type ?? null,
    bonus_type: body.bonus_type, bonus_value: body.bonus_value,
    is_active: body.is_active ?? true,
    note: body.note ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
