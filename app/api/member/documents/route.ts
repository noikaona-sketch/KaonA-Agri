import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from './_auth';

export const dynamic = 'force-dynamic';
const DOC_BUCKET = 'member-docs';

const VALID_DOC_TYPES = ['id_card','farmer_card','land_title','land_doc','vehicle_reg','other'] as const;

// GET — ดูรายการเอกสาร
export async function GET(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s);
  if (!caller.ok) return caller.response;

  const { data, error } = await s.from('member_documents')
    .select('id, doc_type, file_name, storage_path, verified, created_at')
    .eq('member_id', caller.memberId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add public URLs
  const docs = (data ?? []).map(d => ({
    ...d,
    file_url: d.storage_path
      ? s.storage.from(DOC_BUCKET).getPublicUrl(d.storage_path).data.publicUrl
      : null,
  }));

  return NextResponse.json({ documents: docs });
}

// POST — อัปโหลดเอกสาร (multipart)
export async function POST(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s);
  if (!caller.ok) return caller.response;

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'ต้องส่งข้อมูลแบบ multipart/form-data' }, { status: 400 }); }

  const file    = form.get('file');
  const docType = (form.get('doc_type') as string | null)?.trim() ?? 'other';

  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์' }, { status: 400 });

  if (!VALID_DOC_TYPES.includes(docType as typeof VALID_DOC_TYPES[number]))
    return NextResponse.json({ error: 'ประเภทเอกสารไม่ถูกต้อง' }, { status: 400 });

  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: 'ไฟล์ต้องไม่เกิน 10 MB' }, { status: 400 });

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${caller.memberId}/${docType}_${Date.now()}.${ext}`;

  const { error: upErr } = await s.storage
    .from(DOC_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) return NextResponse.json({ error: `อัปโหลดไม่สำเร็จ: ${upErr.message}` }, { status: 500 });

  const { data: saved, error: dbErr } = await s.from('member_documents').insert({
    member_id:       caller.memberId,
    doc_type:        docType,
    storage_path:    path,
    file_name:       file.name,
    mime_type:       file.type,
    file_size_bytes: file.size,
  }).select('id').single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const publicUrl = s.storage.from(DOC_BUCKET).getPublicUrl(path).data.publicUrl;

  return NextResponse.json({
    ok: true,
    id: (saved as { id: string }).id,
    file_url: publicUrl,
    storage_path: path,
  }, { status: 201 });
}

// DELETE — ลบเอกสาร
export async function DELETE(request: Request) {
  const s = createServerSupabaseClient();
  const caller = await resolveApprovedMember(request, s);
  if (!caller.ok) return caller.response;

  const { doc_id } = (await request.json()) as { doc_id?: string };
  if (!doc_id) return NextResponse.json({ error: 'doc_id จำเป็น' }, { status: 400 });

  const { data: doc } = await s.from('member_documents')
    .select('id, member_id, storage_path')
    .eq('id', doc_id).eq('member_id', caller.memberId).maybeSingle();

  if (!doc) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 });

  // Soft delete
  await s.from('member_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', doc_id);

  return NextResponse.json({ ok: true });
}
