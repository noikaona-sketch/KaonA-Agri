import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { getMemberResolutionDiagnostics, resolveApprovedMember } from '../_auth';

const PLOT_SELECT =
  'id,name,area_rai,lat,lng,accuracy,status,province,description,land_doc_type,created_at,' +
  'photos(id)';

const REGISTERED_PLOTS_STATUS_FILTER = 'non_deleted:any_status';

export async function GET(request: Request) {
  const s   = createServerSupabaseClient();
  const url = new URL(request.url);

  // ── Diagnostics: collect before resolve ──────────────────────────────────
  const diag = await getMemberResolutionDiagnostics(request);

  const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });

  if (!caller.ok) {
    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
      endpoint:            '/api/member/plots',
      method:              'GET',
      auth_uid:            diag.authUid,
      current_member_id:   diag.currentMemberId,
      cached_member_id:    request.headers.get('X-Cached-Member-Id') ?? null,
      resolved_member_id_sql: null,
      row_count_returned:  0,
      resolver_ok:         false,
    });
    return caller.response;
  }

  try {
    const { data, error } = await s
      .from('plots')
      .select(PLOT_SELECT)
      .eq('member_id', caller.memberId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', {
        endpoint: '/api/member/plots',
        method:   'GET',
        auth_uid: diag.authUid,
        current_member_id: diag.currentMemberId,
        cached_member_id:  request.headers.get('X-Cached-Member-Id') ?? null,
        resolved_member_id_sql: caller.memberId,
        row_count_returned: 0,
        error: error.message,
      });
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
      endpoint:               '/api/member/plots',
      method:                 'GET',
      auth_uid:               diag.authUid,
      current_member_id:      diag.currentMemberId,
      cached_member_id:       request.headers.get('X-Cached-Member-Id') ?? null,
      resolved_member_id_sql: caller.memberId,
      row_count_returned:     data?.length ?? 0,
      status_filter:          REGISTERED_PLOTS_STATUS_FILTER,
      resolver_ok:            true,
    });

    return Response.json({
      plots:         normalisePlots(data),
      status_filter: REGISTERED_PLOTS_STATUS_FILTER,
    });

  } catch (e) {
    console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', {
      endpoint: '/api/member/plots',
      method:   'GET',
      auth_uid: diag.authUid,
      current_member_id: diag.currentMemberId,
      cached_member_id:  request.headers.get('X-Cached-Member-Id') ?? null,
      resolved_member_id_sql: caller.memberId,
      row_count_returned: 0,
      error: String(e),
    });
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

function normalisePlots(rows: unknown[] | null) {
  if (!rows) return [];
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const photos = row.photos;
    const photoCount = Array.isArray(photos) ? photos.length : 0;
    const { photos: _photos, ...rest } = row;
    return { ...rest, photo_count: photoCount };
  });
}
