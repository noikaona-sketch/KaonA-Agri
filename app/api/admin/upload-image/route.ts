import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const bucket = (form.get('bucket') as string) ?? 'seed-images';
    const folder = (form.get('folder') as string) ?? 'varieties';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `${folder}/${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error } = await s.storage.from(bucket).upload(path, bytes, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: urlData } = s.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: urlData.publicUrl, path });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
