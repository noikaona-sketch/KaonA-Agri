import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { getMemberResolutionDiagnostics, resolveApprovedMember } from '../_auth';
import { appendDiagnosticToJsonResponse, createDiagnosticRequestId, jsonWithDiagnostic } from '../_diagnostics';

// photos(id) gives a count via PostgREST embedded resource.
// public.photos.plot_id FK → plots.id already exists in schema.
const PLOT_SELECT =
  'id,name,area_rai,lat,lng,accuracy,status,province,description,land_doc_type,created_at,' +
  'photos(id)';

const REGISTERED_PLOTS_STATUS_FILTER = 'non_deleted:any_status';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/member/plots
// Resolves the current LINE member server-side and returns non-deleted registered plots.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const diagnosticRequestId = createDiagnosticRequestId();

  try {
    const s = createServerSupabaseClient();
    const url = new URL(request.url);
    const authDiagnostics = await getMemberResolutionDiagnostics(request);
    const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });
    if (!caller.ok) {
      console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
        diagnostic_request_id: diagnosticRequestId,
        endpoint: '/api/member/plots',
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
      .from('plots')
      .select(PLOT_SELECT)
      .eq('member_id', caller.memberId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return jsonWithDiagnostic({ error: error.message }, diagnosticRequestId, { status: 500 });

    console.info('[MEMBER_ENDPOINT_DIAGNOSTIC]', {
      diagnostic_request_id: diagnosticRequestId,
      endpoint: '/api/member/plots',
      auth_uid: authDiagnostics.authUid,
      auth_uid_error: authDiagnostics.authUidError,
      current_member_id: authDiagnostics.currentMemberId,
      current_member_id_error: authDiagnostics.currentMemberIdError,
      request_member_id_query: url.searchParams.get('member_id'),
      cached_member_id: request.headers.get('X-Cached-Member-Id'),
      resolved_member_id_sql: caller.memberId,
      row_count_returned: data?.length ?? 0,
    });

    if ((data ?? []).length === 0) {
      console.info('[MEMBER_PLOTS] 0 registered plots', {
        diagnostic_request_id: diagnosticRequestId,
        memberId: caller.memberId,
        statusFilter: REGISTERED_PLOTS_STATUS_FILTER,
      });
    }

    return jsonWithDiagnostic({
      plots: normalisePlots(data),
      status_filter: REGISTERED_PLOTS_STATUS_FILTER,
    }, diagnosticRequestId);

  } catch (e) {
    console.error('[MEMBER_ENDPOINT_DIAGNOSTIC_ERROR]', {
      diagnostic_request_id: diagnosticRequestId,
      endpoint: '/api/member/plots',
      error: String(e),
    });
    return jsonWithDiagnostic({ error: String(e) }, diagnosticRequestId, { status: 500 });
  }
}

// PostgREST returns photos as an array of objects: [{ id: '...' }, ...]
// Normalise to photo_count: number for the client.
function normalisePlots(rows: unknown[] | null) {
  if (!rows) return [];
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const photos = row.photos;
    const photoCount = Array.isArray(photos) ? photos.length : 0;
    const { photos: _photos, ...rest } = row;
    return { ...rest, photo_count: photoCount };
  });
}
