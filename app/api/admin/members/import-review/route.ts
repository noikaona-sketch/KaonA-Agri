import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../_admin-auth';
import { evaluateMemberReadiness } from '../readiness-policy';

type MemberWithRelations = {
  id: string;
  full_name: string;
  phone: string | null;
  citizen_id_masked: string | null;
  district: string | null;
  subdistrict: string | null;
  province: string | null;
  status: string;
  registration_type: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_verified_status: string | null;
  line_user_id: string | null;
  notes: string | null;
  member_roles?: Array<{ role: string }>;
  plots?: Array<{ id: string }>;
  member_vehicles?: Array<{ id: string }>;
  member_documents?: Array<{ doc_type: string; verified: boolean }>;
};

const REQUIRED_DOC_TYPES = ['citizen_id', 'bank_book'];

function hasDuplicateSignal(m: MemberWithRelations) {
  return (m.citizen_id_masked ?? '').toUpperCase() === 'PENDING' || (m.phone ?? '').trim() === '';
}

function reviewFlags(m: MemberWithRelations) {
  const roles = (m.member_roles ?? []).map((r) => r.role);
  const readiness = evaluateMemberReadiness({
    phone: m.phone,
    address: 'ok',
    subdistrict: m.subdistrict,
    district: m.district,
    province: m.province,
    citizen_id_masked: m.citizen_id_masked,
    line_user_id: m.line_user_id,
    bank_name: m.bank_name,
    bank_account_number: m.bank_account_number,
    bank_verified_status: m.bank_verified_status,
    has_plots: (m.plots ?? []).length > 0,
    has_vehicles: (m.member_vehicles ?? []).length > 0,
    roles,
  });
  const docs = new Set((m.member_documents ?? []).filter((d) => d.verified).map((d) => d.doc_type));
  const missingDocs = REQUIRED_DOC_TYPES.some((d) => !docs.has(d));

  const missingBank = !m.bank_name || !m.bank_account_name || !m.bank_account_number;
  const missingLocation = !m.district || !m.subdistrict || !m.province;
  const missingPhone = !m.phone;
  const duplicateWarning = hasDuplicateSignal(m);
  const readyToApprove = readiness.readyToApprove && !missingDocs && !duplicateWarning;
  const needsCorrection = !readyToApprove || m.status === 'returned';

  return { missingBank, missingLocation, missingPhone, missingDocs, duplicateWarning, readyToApprove, needsCorrection, readiness };
}

export async function GET(request: Request) {
  const permission = await requireAdminPermission('members.import');
  if (isForbidden(permission)) return permission.forbidden;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'imported_only';
  const s = createServerSupabaseClient();

  const { data, error } = await s.from('members').select(`
    id,full_name,phone,citizen_id_masked,district,subdistrict,province,status,registration_type,
    bank_name,bank_account_name,bank_account_number,bank_verified_status,line_user_id,notes,
    member_roles(role),plots(id),member_vehicles(id),member_documents(doc_type,verified)
  `).eq('registration_type', 'admin_import').order('created_at', { ascending: false }).limit(400);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as MemberWithRelations[]).map((m) => {
    const flags = reviewFlags(m);
    return { ...m, ...flags, missingFields: flags.readiness.missingFields };
  });

  const filtered = rows.filter((m) => {
    if (filter === 'missing_bank') return m.missingBank;
    if (filter === 'missing_location') return m.missingLocation;
    if (filter === 'missing_phone') return m.missingPhone;
    if (filter === 'missing_documents') return m.missingDocs;
    if (filter === 'duplicate_warning') return m.duplicateWarning;
    if (filter === 'ready_to_approve') return m.readyToApprove;
    if (filter === 'needs_correction') return m.needsCorrection;
    return true;
  });

  const summary = {
    missing_bank: rows.filter((m) => m.missingBank).length,
    missing_location: rows.filter((m) => m.missingLocation).length,
    duplicate_warning: rows.filter((m) => m.duplicateWarning).length,
    ready: rows.filter((m) => m.readyToApprove).length,
  };

  if (searchParams.get('format') === 'csv') {
    const header = 'id,full_name,phone,status,missing_bank,missing_location,missing_phone,missing_documents,duplicate_warning,ready_to_approve\n';
    const csvRows = filtered.map((r) => [r.id, r.full_name, r.phone ?? '', r.status, r.missingBank, r.missingLocation, r.missingPhone, r.missingDocs, r.duplicateWarning, r.readyToApprove].join(','));
    return new NextResponse(header + csvRows.join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
  }

  return NextResponse.json({ members: filtered, summary });
}

export async function POST(req: Request) {
  const permission = await requireAdminPermission('members.import');
  if (isForbidden(permission)) return permission.forbidden;
  const body = (await req.json()) as { ids?: string[]; action?: 'mark_needs_correction' | 'bulk_status_note'; note?: string };
  const ids = body.ids ?? [];
  if (ids.length === 0) return NextResponse.json({ error: 'ต้องระบุ ids' }, { status: 400 });

  const s = createServerSupabaseClient();
  if (body.action === 'mark_needs_correction') {
    const stamp = new Date().toISOString();
    const { data: existing, error: readError } = await s.from('members')
      .select('id,notes')
      .in('id', ids)
      .eq('registration_type', 'admin_import');
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

    const updates = (existing ?? []).map((row) => {
      const base = (row.notes ?? '').trim();
      const marker = `[import_review][needs_correction] ${stamp}`;
      const notes = base ? `${base}
${marker}` : marker;
      return s.from('members').update({ notes, updated_at: stamp }).eq('id', row.id).eq('registration_type', 'admin_import');
    });
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'bulk_status_note') {
    const { error } = await s.from('members').update({ notes: body.note ?? null, updated_at: new Date().toISOString() }).in('id', ids).eq('registration_type', 'admin_import');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
}
