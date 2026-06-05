import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s);
  if (!caller.ok) return caller.response;

  const body = await request.json() as {
    planting_cycle_id: string;
    plot_id?:          string | null;
    activity_type:     string;
    note?:             string | null;
    plant_height_cm?:  number | null;
    pest_name?:        string | null;
    severity?:         string | null;
    gps_lat?:          number | null;
    gps_lng?:          number | null;
    recorded_at?:      string;
  };

  if (!body.planting_cycle_id || !body.activity_type)
    return NextResponse.json({ error: 'planting_cycle_id และ activity_type จำเป็น' }, { status: 400 });

  const { data, error } = await s.from('farm_activity_logs').insert({
    planting_cycle_id: body.planting_cycle_id,
    member_id:         caller.memberId,
    plot_id:           body.plot_id           ?? null,
    activity_type:     body.activity_type,
    note:              body.note              ?? null,
    plant_height_cm:   body.plant_height_cm   ?? null,
    pest_name:         body.pest_name         ?? null,
    severity:          body.severity          ?? null,
    gps_lat:           body.gps_lat           ?? null,
    gps_lng:           body.gps_lng           ?? null,
    recorded_at:       body.recorded_at       ?? new Date().toISOString(),
  }).select('id').single();

  if (error) {
    console.error('[FARM_ACTIVITY] insert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: (data as { id: string }).id }, { status: 201 });
}

export async function GET(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s);
  if (!caller.ok) return caller.response;

  const url     = new URL(request.url);
  const cycleId = url.searchParams.get('planting_cycle_id') ?? '';
  const limit   = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);

  if (!cycleId)
    return NextResponse.json({ error: 'planting_cycle_id จำเป็น' }, { status: 400 });

  const { data, error } = await s.from('farm_activity_logs')
    .select('id, activity_type, note, plant_height_cm, pest_name, severity, recorded_at, gps_lat, gps_lng')
    .eq('planting_cycle_id', cycleId)
    .eq('member_id', caller.memberId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
