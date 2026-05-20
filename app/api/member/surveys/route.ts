import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

async function resolveMember(request: Request, s: ReturnType<typeof createServerSupabaseClient>) {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user } } = await s.auth.getUser(token);
  if (!user) return null;
  const { data: member } = await s.from('members').select('id,status').eq('auth_user_id', user.id).maybeSingle();
  if (!member || member.status !== 'approved') return null;
  return member.id as string;
}

export async function GET(request: Request) {
  const s = createServerSupabaseClient();
  const memberId = await resolveMember(request, s);
  if (!memberId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: surveys } = await s.from('surveys').select('id,title,description').eq('is_active', true).order('created_at',{ascending:false}).limit(20);
  const ids = (surveys ?? []).map((x:any)=>x.id);
  const { data: questions } = await s.from('survey_questions').select('id,survey_id,question_text,question_type,choices,order_no').in('survey_id', ids.length?ids:['00000000-0000-0000-0000-000000000000']).order('order_no');
  return NextResponse.json({ surveys: surveys ?? [], questions: questions ?? [] });
}

export async function POST(request: Request) {
  const s = createServerSupabaseClient();
  const memberId = await resolveMember(request, s);
  if (!memberId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json();
  const surveyId = String(body?.survey_id ?? '');
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (!surveyId || answers.length === 0) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  const { data: response, error } = await s.from('survey_responses').insert({ survey_id: surveyId, member_id: memberId }).select('id').single();
  if (error || !response) return NextResponse.json({ error: error?.message ?? 'create failed' }, { status: 500 });
  const rows = answers.map((a:any)=>({ response_id: response.id, question_id: a.question_id, answer_text: a.answer_text ?? null, answer_number: a.answer_number ?? null, answer_yes_no: typeof a.answer_yes_no==='boolean'?a.answer_yes_no:null, answer_choice: a.answer_choice ?? null }));
  const { error: aErr } = await s.from('survey_response_answers').insert(rows);
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
