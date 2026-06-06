create table assessments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null,
  email text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  completed boolean default false,
  conversation_history jsonb default '[]'
);

create index assessments_session_id_idx on assessments(session_id);
