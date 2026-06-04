import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { getMemberResolutionDiagnostics, resolveApprovedMember } from '../_auth';
import { appendDiagnosticToJsonResponse, createDiagnosticRequestId, jsonWithDiagnostic } from '../_diagnostics';
import { isCornSeedProduct }          from '@/lib/products/corn-seed';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const diagnosticRequestId = createDiagnosticRequestId();

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
    const authDiagnostics = await getMemberResolutionDiagnostics(request);
    const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });
    if (!caller.ok) {
      console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
        diagnostic_request_id: diagnosticRequestId,
        endpoint: '/api/member/planting-cycles',
        method: 'POST',
        auth_uid: authDiagnostics.authUid,
        auth_uid_error: authDiagnostics.authUidError,
        current_member_id: authDiagnostics.currentMemberId,
        current_member_id_error: authDiagnostics.currentMemberIdError,
        request_member_id_body: body.member_id ?? null,
        request_plot_id_body: body.plot_id ?? null,
        cached_member_id: request.headers.get('X-Cached-Member-Id'),
        row_count_returned: 0,
        resolver_ok: false,
      });
      return appendDiagnosticToJsonResponse(caller.response, diagnosticRequestId);
    }

    if (!body.plot_id) {
      return jsonWithDiagnostic({ error: 'กรุณาเลือกแปลงก่อนสร้างรอบปลูก' }, diagnosticRequestId, { status: 400 });
    }
    if (!body.expected_harvest_at) {
      return jsonWithDiagnostic({ error: 'กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว' }, diagnosticRequestId, { status: 400 });
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

    if (error) return jsonWithDiagnostic({ error: error.message }, diagnosticRequestId, { status: 500 });

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

    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
      diagnostic_request_id: diagnosticRequestId,
      endpoint: '/api/member/planting-cycles',
      method: 'POST',
      auth_uid: authDiagnostics.authUid,
      auth_uid_error: authDiagnostics.authUidError,
      current_member_id: authDiagnostics.currentMemberId,
      current_member_id_error: authDiagnostics.currentMemberIdError,
      request_member_id_body: body.member_id ?? null,
      request_plot_id_body: body.plot_id ?? null,
      cached_member_id: request.headers.get('X-Cached-Member-Id'),
      resolved_member_id_sql: caller.memberId,
      row_count_returned: 1,
      created_planting_cycle_id: cycleId,
    });

    return jsonWithDiagnostic({ ok:true, id: cycleId }, diagnosticRequestId);
  } catch (e) {
    console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', {
      diagnostic_request_id: diagnosticRequestId,
      endpoint: '/api/member/planting-cycles',
      method: 'POST',
      error: String(e),
    });
    return jsonWithDiagnostic({ error: String(e) }, diagnosticRequestId, { status: 500 });
  }
}

export async function GET(request: Request) {
  const diagnosticRequestId = createDiagnosticRequestId();

  try {
    const s      = createServerSupabaseClient();
    const url    = new URL(request.url);
    const authDiagnostics = await getMemberResolutionDiagnostics(request);
    const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });
    if (!caller.ok) {
      console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
        diagnostic_request_id: diagnosticRequestId,
        endpoint: '/api/member/planting-cycles',
        method: 'GET',
        auth_uid: authDiagnostics.authUid,
        auth_uid_error: authDiagnostics.authUidError,
        current_member_id: authDiagnostics.currentMemberId,
        current_member_id_error: authDiagnostics.currentMemberIdError,
        request_member_id_query: url.searchParams.get('member_id'),
        request_line_user_id_query: url.searchParams.get('line_user_id'),
        cached_member_id: request.headers.get('X-Cached-Member-Id'),
        resolver_ok: false,
      });
      return appendDiagnosticToJsonResponse(caller.response, diagnosticRequestId);
    }
    const { data, error } = await s
      .from('planting_cycles')
      .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,plot_id')
      .eq('member_id', caller.memberId)
      .not('status', 'in', '(harvested,cancelled)')
      .order('created_at', { ascending: false });
    if (error) return jsonWithDiagnostic({ error: error.message }, diagnosticRequestId, { status: 500 });
    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
      diagnostic_request_id: diagnosticRequestId,
      endpoint: '/api/member/planting-cycles',
      method: 'GET',
      auth_uid: authDiagnostics.authUid,
      auth_uid_error: authDiagnostics.authUidError,
      current_member_id: authDiagnostics.currentMemberId,
      current_member_id_error: authDiagnostics.currentMemberIdError,
      request_member_id_query: url.searchParams.get('member_id'),
      request_line_user_id_query: url.searchParams.get('line_user_id'),
      cached_member_id: request.headers.get('X-Cached-Member-Id'),
      resolved_member_id_sql: caller.memberId,
      row_count_returned: data?.length ?? 0,
    });
    return jsonWithDiagnostic({ cycles: data ?? [] }, diagnosticRequestId);
  } catch (e) {
    console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', {
      diagnostic_request_id: diagnosticRequestId,
      endpoint: '/api/member/planting-cycles',
      method: 'GET',
      error: String(e),
    });
    return jsonWithDiagnostic({ error: String(e) }, diagnosticRequestId, { status: 500 });
  }
}
