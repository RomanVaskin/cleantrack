create table if not exists telegram_sessions (
  chat_id bigint primary key,
  state text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  telegram_chat_id bigint not null,
  telegram_username text,
  client_name text not null,
  client_phone text not null,
  address text not null,
  rooms integer not null,
  windows_count integer not null default 0,
  ironing_hours integer not null default 0,
  balcony boolean not null default false,
  photo_report_enabled boolean not null default false,
  other_request text,
  base_price integer not null,
  extras_price integer not null,
  total_price integer not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
