-- PR25 Field Survey Foundation (minimal)

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('text','number','yes_no','choice')),
  choices jsonb,
  order_no int not null default 1,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.survey_response_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  answer_text text,
  answer_number numeric,
  answer_yes_no boolean,
  answer_choice text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_survey_answers_response_question on public.survey_response_answers(response_id, question_id);
create index if not exists idx_survey_questions_survey on public.survey_questions(survey_id, order_no);
create index if not exists idx_survey_responses_survey on public.survey_responses(survey_id, submitted_at desc);
create index if not exists idx_survey_responses_member on public.survey_responses(member_id, submitted_at desc);

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_response_answers enable row level security;

-- Keep simple: anon can read active surveys/questions, and can submit responses.
create policy if not exists surveys_read_active on public.surveys
for select to anon, authenticated
using (is_active = true);

create policy if not exists survey_questions_read on public.survey_questions
for select to anon, authenticated
using (true);

create policy if not exists survey_responses_insert on public.survey_responses
for insert to anon, authenticated
with check (true);

create policy if not exists survey_responses_read on public.survey_responses
for select to anon, authenticated
using (true);

create policy if not exists survey_answers_insert on public.survey_response_answers
for insert to anon, authenticated
with check (true);

create policy if not exists survey_answers_read on public.survey_response_answers
for select to anon, authenticated
using (true);
