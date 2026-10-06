create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  photo_url text,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  theme text default 'light',
  notifications boolean default true,
  auto_parse boolean default true,
  default_niche text default 'Estética',
  instagram_link text,
  two_factor boolean default false,
  language text default 'pt-BR',
  privacy_mode boolean default false
);

create table if not exists public.message_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  niche text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subtitle text,
  niche text,
  description text,
  color text,
  message_campaign_id uuid references public.message_campaigns(id) on delete set null,
  lead_count integer not null default 0,
  response_rate numeric(5,2) not null default 0,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references public.boards(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text,
  instagram_handle text not null,
  instagram_url text,
  followers_count integer,
  city text,
  bio text,
  status text not null default 'new' check (status in ('new','qualified','contacted','responded','interested','proposal','closed')),
  score numeric not null default 0,
  parsing_confidence numeric not null default 0,
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  assigned_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.message_variations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.message_campaigns(id) on delete cascade,
  title text,
  text text not null,
  is_active boolean not null default true,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('status_change','message_sent','note_added','follow_up_scheduled')),
  content text not null,
  variation_id uuid references public.message_variations(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.leads enable row level security;
alter table public.message_campaigns enable row level security;
alter table public.message_variations enable row level security;
alter table public.lead_history enable row level security;
