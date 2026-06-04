import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { getMemberResolutionDiagnostics, resolveApprovedMember } from '../_auth';
import { isCornSeedProduct } from '@/lib/products/corn-seed';

export const dynamic = 'force-dynamic';

// ── Shared diagnostic shape ──────────────────────────────────────────────────
function makeDiag(
  method: string,
  diag: Awaited<ReturnType<typeof getMemberResolutionDiagnostics>>,
  request: Request,
  extra: Record<string, unknown> = {},
) {
  return {
    endpoint:            '/api/member/planting-cycles',
    method,
    auth_uid:            diag.authUid,
    current_member_id:   diag.currentMemberId,
    cached_member_id:    request.headers.get('X-Cached-Member-Id') ?? null,
    ...extra,
  };
}

// ── GET /api/member/planting-cycles ─────────────────────────────────────────
export async function GET(request: Request) {
  const s    = createServerSupabaseClient();
  const diag = await getMemberResolutionDiagnostics(request);

  const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });

  if (!caller.ok) {
    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', makeDiag('GET', diag, request, {
      resolved_member_id_sql: null,
      row_count_returned:     0,
      resolver_ok:            false,
    }));
    return caller.response;
  }

  try {
    const { data, error } = await s
      .from('planting_cycles')
      .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,plot_id')
      .eq('member_id', caller.memberId)
      .not('status', 'in', '(harvested,cancelled)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', makeDiag('GET', diag, request, {
        resolved_member_id_sql: caller.memberId,
        row_count_returned:     0,
        error:                  error.message,
      }));
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', makeDiag('GET', diag, request, {
      resolved_member_id_sql: caller.memberId,
      row_count_returned:     data?.length ?? 0,
      resolver_ok:            true,
    }));

    return Response.json({ cycles: data ?? [] });

  } catch (e) {
    console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', makeDiag('GET', diag, request, {
      resolved_member_id_sql: caller.memberId,
      row_count_returned:     0,
      error:                  String(e),
    }));
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// ── POST /api/member/planting-cycles ────────────────────────────────────────
export async function POST(request: Request) {
  const diag = await getMemberResolutionDiagnostics(request);

  let body: {
    member_id?: string; crop_name: string; plot_id: string;
    product_id?: string | null; planted_at: string;
    expected_harvest_at?: string | null; area_planted_rai?: number | null;
    season_year?: number; quota_kg?: number | null;
    status?: string; source?: string; member_note?: string | null;
    confirmed_at?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const s      = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });

  if (!caller.ok) {
    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', makeDiag('POST', diag, request, {
      resolved_member_id_sql: null,
      row_count_returned:     0,
      resolver_ok:            false,
    }));
    return caller.response;
  }

  if (!body.plot_id) {
    return Response.json({ error: 'กรุณาเลือกแปลงก่อนสร้างรอบปลูก' }, { status: 400 });
  }
  if (!body.expected_harvest_at) {
    return Response.json({ error: 'กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว' }, { status: 400 });
  }

  try {
    const usesBillFlow = isCornSeedProduct({
      category: 'seed', product_type: 'seed',
      crop_type: body.crop_name, name: body.crop_name,
    });

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

    if (error) {
      console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', makeDiag('POST', diag, request, {
        resolved_member_id_sql: caller.memberId,
        row_count_returned:     0,
        error:                  error.message,
      }));
      return Response.json({ error: error.message }, { status: 500 });
    }

    const cycleId   = (data as { id: string }).id;
    const plantedAt = body.planted_at ? new Date(body.planted_at) : null;

    // ── Seed scheduled reminder logs (best-effort) ────────────────────────
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

    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', makeDiag('POST', diag, request, {
      resolved_member_id_sql:   caller.memberId,
      row_count_returned:       1,
      created_planting_cycle_id: cycleId,
      resolver_ok:              true,
    }));

    return Response.json({ ok: true, id: cycleId });

  } catch (e) {
    console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', makeDiag('POST', diag, request, {
      resolved_member_id_sql: caller.memberId,
      row_count_returned:     0,
      error:                  String(e),
    }));
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
