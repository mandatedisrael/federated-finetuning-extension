create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.ffe_projects (
  id text primary key,
  template_id text not null,
  name text not null,
  goal text not null,
  owner_privy_id text not null,
  stage text not null check (stage in ('waiting', 'checking', 'training', 'ready')),
  deadline date not null,
  stake_usd numeric(12, 2) not null default 0,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ffe_contributors (
  id text primary key,
  project_id text not null references public.ffe_projects(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('owner', 'contributor')),
  status text not null check (
    status in ('not-started', 'uploaded', 'validated', 'included', 'needs-attention', 'rejected')
  ),
  example_count integer not null default 0 check (example_count >= 0),
  avatar_url text,
  wallet_address text,
  ffe_public_key text,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ffe_must_pass_scenarios (
  id text primary key,
  project_id text not null references public.ffe_projects(id) on delete cascade,
  prompt text not null,
  expected text not null,
  result text check (result in ('pass', 'fail')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ffe_project_versions (
  id text primary key,
  project_id text not null references public.ffe_projects(id) on delete cascade,
  label text not null,
  summary text not null,
  published_at timestamptz not null,
  published_by text not null,
  published_by_id text not null,
  must_pass_passed integer not null default 0,
  must_pass_total integer not null default 0,
  contributor_ids text[] not null default '{}',
  vote_summary jsonb,
  overridden boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ffe_chain_sessions (
  project_id text primary key references public.ffe_projects(id) on delete cascade,
  mode text not null check (mode in ('server-proxy', 'wallet-owner')),
  session_id text not null unique,
  base_model text not null,
  participant_address text not null,
  participant_pubkey text not null,
  aggregator_pubkey text not null,
  create_tx_hash text not null,
  set_aggregator_tx_hash text,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ffe_chain_participants (
  project_id text not null references public.ffe_projects(id) on delete cascade,
  session_id text not null references public.ffe_chain_sessions(session_id) on delete cascade,
  contributor_id text not null references public.ffe_contributors(id) on delete cascade,
  address text not null,
  public_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, contributor_id)
);

create table if not exists public.ffe_submission_receipts (
  id text primary key,
  project_id text not null references public.ffe_projects(id) on delete cascade,
  contributor_id text not null,
  contributor_name text not null,
  session_id text not null,
  example_count integer not null default 0 check (example_count >= 0),
  root_hash text not null,
  storage_tx_hash text not null,
  submit_tx_hash text not null,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ffe_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.ffe_projects(id) on delete cascade,
  session_id text not null,
  token_id text,
  model_blob_hash text,
  artifact_size_bytes bigint,
  downloaded_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, session_id, token_id)
);

create table if not exists public.ffe_invite_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.ffe_projects(id) on delete cascade,
  contributor_id text references public.ffe_contributors(id) on delete set null,
  recipient text not null,
  status text not null check (status in ('sent', 'preview', 'failed')),
  message_id text,
  error text,
  sent_at timestamptz not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, recipient, sent_at)
);

create table if not exists public.ffe_project_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.ffe_projects(id) on delete cascade,
  actor_privy_id text,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ffe_projects_invite_code_idx on public.ffe_projects (invite_code);
create index if not exists ffe_contributors_project_id_idx on public.ffe_contributors (project_id);
create index if not exists ffe_contributors_wallet_idx on public.ffe_contributors (wallet_address);
create unique index if not exists ffe_contributors_project_email_idx
  on public.ffe_contributors (project_id, lower(email));
create index if not exists ffe_submissions_project_id_idx on public.ffe_submission_receipts (project_id);
create index if not exists ffe_events_project_id_created_at_idx
  on public.ffe_project_events (project_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ffe_projects',
    'ffe_contributors',
    'ffe_must_pass_scenarios',
    'ffe_project_versions',
    'ffe_chain_sessions',
    'ffe_chain_participants',
    'ffe_submission_receipts',
    'ffe_artifacts',
    'ffe_invite_deliveries',
    'ffe_project_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ffe_projects',
    'ffe_contributors',
    'ffe_must_pass_scenarios',
    'ffe_project_versions',
    'ffe_chain_sessions',
    'ffe_chain_participants',
    'ffe_submission_receipts',
    'ffe_artifacts',
    'ffe_invite_deliveries'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end $$;
