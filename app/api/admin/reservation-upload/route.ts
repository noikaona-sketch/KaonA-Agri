// POST: upload reservation attachment to Supabase Storage
// Body: raw binary (image/jpeg, image/png, image/webp, application/pdf)
// Headers: x-file-path, x-file-type
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

const BUCKET = 'reservation-attachments';

export async function POST(req: NextRequest) {
  try {
  const _ar_post = await requireAdminPermission('service.write');
  if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const path     = req.headers.get('x-file-path') ?? '';
    const mimeType = req.headers.get('x-file-type')  ?? 'image/jpeg';

    if (!path) return NextResponse.json({ error: 'x-file-path required' }, { status: 400 });

    const validTypes = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (!validTypes.includes(mimeType))
      return NextResponse.json({ error: 'file type not allowed' }, { status: 400 });

    const body   = await req.arrayBuffer();
    const buffer = Buffer.from(body);
    const s      = createServerSupabaseClient();

    const { error } = await s.storage.from(BUCKET).upload(path, buffer, {
      contentType:  mimeType,
      upsert:       false,
      cacheControl: '3600',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // signed URL valid 10 years (admin-only bucket, not public)
    const { data: signed } = await s.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    const url = signed?.signedUrl ?? '';

    return NextResponse.json({ url, path });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

// DELETE: remove attachment by path
export async function DELETE(req: NextRequest) {
  try {
  const _ar_delete = await requireAdminPermission('service.write');
  if (isForbidden(_ar_delete)) return _ar_delete.forbidden;

    const { path } = (await req.json()) as { path?: string };
    if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });
    const s = createServerSupabaseClient();
    const { error } = await s.storage.from(BUCKET).remove([path]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
