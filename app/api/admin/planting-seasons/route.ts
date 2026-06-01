import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/planting-seasons?with_stats=true
export async function GET(request: Request) {
  const auth = await requireAdminPermission('field.read');
  if (isForbidden(auth)) return auth.forbidden;

  const url      = new URL(request.url);
  const withStats = url.searchParams.get('with_stats') === 'true';
  const s        = createServerSupabaseClient();

  const { data: seasons, error } = await s
    .from('planting_seasons')
    .select('id,name,season_year,crop_type,planting_start,planting_end,harvest_start,harvest_end,registration_opens,registration_closes,noburn_bonus_type,noburn_bonus_value,seed_quota_kg,is_active,note,created_at')
    .order('planting_start', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!withStats) return NextResponse.json({ seasons: seasons ?? [] });

  // ── Stats per season ──────────────────────────────────────────────────────
  const ids = (seasons ?? []).map((s) => s.id);
  if (ids.length === 0) return NextResponse.json({ seasons: [] });

  // 1. แจ้งปลูก
  const { data: cycleStats } = await s
    .from('planting_cycles')
    .select('planting_season_id, plots(area_rai)')
    .in('planting_season_id', ids)
    .not('planting_season_id', 'is', null);

  // 2. ไม่เผา
  const { data: noburnStats } = await s
    .from('no_burn_requests')
    .select('planting_season_id, status, plots(area_rai)')
    .in('planting_season_id', ids)
    .not('planting_season_id', 'is', null);

  // 3. เมล็ดพันธุ์ที่รับไป
  const { data: seedStats } = await s
    .from('seed_reservations')
    .select('planting_season_id, qty_received, qty_reserved, status')
    .in('planting_season_id', ids)
    .not('planting_season_id', 'is', null);

  // 4. ยอดขาย (harvest_bookings — เฉพาะ corn ถึงมียอดตัน)
  const { data: harvestStats } = await s
    .from('harvest_bookings')
    .select('planting_season_id, actual_received_kg, status')
    .in('planting_season_id', ids)
    .not('planting_season_id', 'is', null)
    .in('status', ['completed']);

  // ── aggregate per season ──────────────────────────────────────────────────
  type Stats = {
    planting_count: number; planting_rai: number;
    noburn_count: number;   noburn_rai: number;   noburn_approved: number;
    seed_kg: number;        seed_quota_used_pct: number | null;
    harvest_ton: number;    harvest_count: number;
  };

  const statsMap: Record<string, Stats> = {};
  for (const id of ids) {
    statsMap[id] = {
      planting_count: 0, planting_rai: 0,
      noburn_count: 0,   noburn_rai: 0, noburn_approved: 0,
      seed_kg: 0,        seed_quota_used_pct: null,
      harvest_ton: 0,    harvest_count: 0,
    };
  }

  for (const c of cycleStats ?? []) {
    const sid = c.planting_season_id as string;
    if (!statsMap[sid]) continue;
    statsMap[sid].planting_count++;
    const plots = c.plots as unknown as { area_rai: number }[] | null;
    statsMap[sid].planting_rai += plots?.[0]?.area_rai ?? 0;
  }

  for (const n of noburnStats ?? []) {
    const sid = n.planting_season_id as string;
    if (!statsMap[sid]) continue;
    statsMap[sid].noburn_count++;
    const plots = n.plots as unknown as { area_rai: number }[] | null;
    statsMap[sid].noburn_rai += plots?.[0]?.area_rai ?? 0;
    if (['approved','completed'].includes(n.status as string)) statsMap[sid].noburn_approved++;
  }

  for (const r of seedStats ?? []) {
    const sid = r.planting_season_id as string;
    if (!statsMap[sid]) continue;
    statsMap[sid].seed_kg += Number(r.qty_received ?? r.qty_reserved ?? 0);
  }

  for (const h of harvestStats ?? []) {
    const sid = h.planting_season_id as string;
    if (!statsMap[sid]) continue;
    statsMap[sid].harvest_count++;
    statsMap[sid].harvest_ton += Number(h.actual_received_kg ?? 0) / 1000;
  }

  // seed quota %
  const seasonMap = Object.fromEntries((seasons ?? []).map((s) => [s.id, s]));
  for (const id of ids) {
    const quota = seasonMap[id]?.seed_quota_kg;
    if (quota && statsMap[id].seed_kg > 0) {
      statsMap[id].seed_quota_used_pct = Math.round((statsMap[id].seed_kg / quota) * 100);
    }
  }

  const result = (seasons ?? []).map((s) => ({ ...s, stats: statsMap[s.id] }));
  return NextResponse.json({ seasons: result });
}

type SeasonPayload = {
  id?               : string;
  name              : string;
  season_year       : number;
  crop_type         : string;
  planting_start    : string;
  planting_end      : string;
  harvest_start?    : string | null;
  harvest_end?      : string | null;
  registration_opens?  : string | null;
  registration_closes? : string | null;
  noburn_bonus_type : 'per_ton' | 'per_rai';
  noburn_bonus_value: number;
  seed_quota_kg?    : number | null;
  is_active?        : boolean;
  note?             : string | null;
};

export async function POST(request: Request) {
  const auth = await requireAdminPermission('field.write');
  if (isForbidden(auth)) return auth.forbidden;

  const body = (await request.json()) as SeasonPayload;
  if (!body.name?.trim() || !body.crop_type || !body.planting_start || !body.planting_end)
    return NextResponse.json({ error: 'name, crop_type, planting_start, planting_end จำเป็น' }, { status: 400 });

  // auto bonus_type from crop
  const bonusType = body.crop_type === 'corn' ? 'per_ton' : 'per_rai';

  const s = createServerSupabaseClient();
  const { data, error } = await s.from('planting_seasons').insert({
    name: body.name.trim(), season_year: body.season_year,
    crop_type: body.crop_type,
    planting_start: body.planting_start, planting_end: body.planting_end,
    harvest_start:  body.harvest_start  ?? null,
    harvest_end:    body.harvest_end    ?? null,
    registration_opens:  body.registration_opens  ?? null,
    registration_closes: body.registration_closes ?? null,
    noburn_bonus_type:  bonusType,
    noburn_bonus_value: body.noburn_bonus_value ?? 0,
    seed_quota_kg: body.seed_quota_kg ?? null,
    is_active: body.is_active ?? true,
    note: body.note ?? null,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminPermission('field.write');
  if (isForbidden(auth)) return auth.forbidden;

  const body = (await request.json()) as SeasonPayload;
  if (!body.id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 });

  const bonusType = body.crop_type === 'corn' ? 'per_ton' : 'per_rai';
  const s = createServerSupabaseClient();
  const { error } = await s.from('planting_seasons').update({
    name: body.name.trim(), season_year: body.season_year,
    crop_type: body.crop_type,
    planting_start: body.planting_start, planting_end: body.planting_end,
    harvest_start:  body.harvest_start  ?? null,
    harvest_end:    body.harvest_end    ?? null,
    registration_opens:  body.registration_opens  ?? null,
    registration_closes: body.registration_closes ?? null,
    noburn_bonus_type:  bonusType,
    noburn_bonus_value: body.noburn_bonus_value ?? 0,
    seed_quota_kg: body.seed_quota_kg ?? null,
    is_active: body.is_active ?? true,
    note: body.note ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
