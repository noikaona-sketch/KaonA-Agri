import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { getMemberResolutionDiagnostics, resolveApprovedMember } from '../_auth';
import { isCornSeedProduct }          from '@/lib/products/corn-seed';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      member_id?:string; crop_name:string; plot_id:string;
      product_id?:string|null; planted_at:string;
      expected_harvest_at?:string|null; area_planted_rai?:number|null;
      season_year?:number; quota_kg?:number|null;
      status?:string; source?:string; member_note?:string|null;
      confirmed_at?:string;
    };

    const s      = createServerSupabaseClient();
    const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });
    if (!caller.ok) return caller.response;

    if (!body.plot_id) {
      return NextResponse.json({ error: 'กรุณาเลือกแปลงก่อนสร้างรอบปลูก' }, { status: 400 });
    }
    if (!body.expected_harvest_at) {
      return NextResponse.json({ error: 'กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว' }, { status: 400 });
    }

    const usesBillFlow = isCornSeedProduct({ category:'seed', product_type:'seed', crop_type:body.crop_name, name:body.crop_name });

    const { data, error } = await s
      .from('planting_cycles')
      .insert({
        member_id:           caller.memberId,
        crop_name:           body.crop_name,
        plot_id:             body.plot_id,
        product_id:          usesBillFlow ? (body.product_id || null) : null,
        planted_at:          body.planted_at,
        expected_harvest_at: body.expected_harvest_at || null,
        area_planted_rai:    body.area_planted_rai ?? null,
        season_year:         body.season_year ?? (new Date().getFullYear() + 543),
        quota_kg:            usesBillFlow ? (body.quota_kg ?? null) : null,
        status:              body.status ?? 'growing',
        source:              'manual',
        created_by:          caller.memberId,
        role_used:           'farmer',
        member_note:         body.member_note ?? null,
        confirmed_at:        body.confirmed_at ?? new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const cycleId   = (data as { id: string }).id;
    const plantedAt = body.planted_at ? new Date(body.planted_at) : null;

    // ── Seed scheduled reminder logs from care_defaults (best-effort) ─────────
    if (plantedAt) {
      void (async () => {
        try {
          const { data: careData } = await s
            .from('crop_care_defaults')
            .select('care_schedule')
            .eq('crop_type', body.crop_name)
            .maybeSingle();

          const schedule = (careData?.care_schedule as {
            day: number; activity: string; label: string; icon: string;
            note?: string; warning_days?: number;
          }[]) ?? [];

          if (schedule.length > 0) {
            const rows = schedule.map(item => {
              const dueDate = new Date(plantedAt);
              dueDate.setDate(dueDate.getDate() + item.day);
              return {
                planting_cycle_id: cycleId,
                member_id:         caller.memberId,
                plot_id:           body.plot_id || null,
                activity_type:     item.activity === 'harvest' ? 'other' : item.activity,
                note:              `${item.icon} ${item.label}${item.note ? ` — ${item.note}` : ''}`,
                scheduled_day:     item.day,
                reminder_due_at:   dueDate.toISOString(),
                is_scheduled:      true,
                reminder_sent:     false,
                recorded_at:       dueDate.toISOString(),
              };
            });
            // Insert only if not already seeded (idempotent)
            await s.from('farm_activity_logs').upsert(rows, {
              onConflict: 'planting_cycle_id,scheduled_day',
              ignoreDuplicates: true,
            });
          }
        } catch (e) {
          console.warn('[CYCLE_CREATE] failed to seed reminder logs:', e);
        }
      })();
    }

    return NextResponse.json({ ok:true, id: cycleId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const url    = new URL(request.url);
    const authDiagnostics = await getMemberResolutionDiagnostics(request);
    const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });
    if (!caller.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await s
      .from('planting_cycles')
      .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,plot_id')
      .eq('member_id', caller.memberId)
      .not('status', 'in', '(harvested,cancelled)')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
      endpoint: '/api/member/planting-cycles',
      auth_uid: authDiagnostics.authUid,
      auth_uid_error: authDiagnostics.authUidError,
      current_member_id: authDiagnostics.currentMemberId,
      current_member_id_error: authDiagnostics.currentMemberIdError,
      request_member_id_query: url.searchParams.get('member_id'),
      cached_member_id: request.headers.get('X-Cached-Member-Id'),
      resolved_member_id_sql: caller.memberId,
      row_count_returned: data?.length ?? 0,
    });
    return NextResponse.json({ cycles: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
