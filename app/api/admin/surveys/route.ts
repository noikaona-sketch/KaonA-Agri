import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../members/_admin-auth';

export async function GET() {
  const auth = await requireAdminPermission('field.read');
  if (isForbidden(auth)) return auth.forbidden;
  const s = createServerSupabaseClient();
  const { data, error } = await s.from('surveys').select('id,title,description,is_active,created_at').order('created_at',{ascending:false}).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ surveys: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminPermission('field.write');
  if (isForbidden(auth)) return auth.forbidden;
  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  const description = String(body?.description ?? '').trim() || null;
  const questions = Array.isArray(body?.questions) ? body.questions : [];
  if (!title || questions.length === 0) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  const s = createServerSupabaseClient();
  const { data: survey, error } = await s.from('surveys').insert({ title, description, created_by: auth.admin.adminUserId }).select('id').single();
  if (error || !survey) return NextResponse.json({ error: error?.message ?? 'create failed' }, { status: 500 });
  const rows = questions.map((q: any, idx: number) => ({
    survey_id: survey.id,
    question_text: String(q.question_text ?? '').trim(),
    question_type: String(q.question_type ?? 'text'),
    choices: q.question_type === 'choice' ? (q.choices ?? []) : null,
    order_no: idx + 1,
    required: true,
  })).filter((q: any) => q.question_text);
  const { error: qErr } = await s.from('survey_questions').insert(rows);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: survey.id }, { status: 201 });
}
