-- CleanTrack: standalone PostgreSQL schema for a new database.
create table if not exists cleanings (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  client_name text not null,
  client_phone text,
  address text not null,
  started_at timestamptz,
  status text not null,
  completed_at timestamptz,
  accepted_at timestamptz,
  client_token text unique,
  photo_report_enabled boolean not null default false,
  requested_date date,
  requested_time text,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  sort_order integer not null default 0,
  -- Base-cleaning checklist items belong to a fixed section ('rooms' | 'kitchen' |
  -- 'bathroom' | 'completion'); NULL keeps a service in the flat add-on catalog.
  section_code text,
  section_order integer
);

create table if not exists cleaning_services (
  id uuid primary key default gen_random_uuid(),
  cleaning_id uuid not null references cleanings(id) on delete cascade,
  service_id uuid not null references services(id) on delete restrict,
  is_selected boolean not null default true,
  is_done boolean not null default false,
  note text,
  completed_at timestamptz
);

create table if not exists client_rules (
  id uuid primary key default gen_random_uuid(),
  cleaning_id uuid unique not null references cleanings(id) on delete cascade,
  cabinets_access text,
  personal_items_access text,
  do_not_touch text,
  special_requests text
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  cleaning_id uuid not null references cleanings(id) on delete cascade,
  cleaning_service_id uuid references cleaning_services(id) on delete set null,
  -- Section-level photo (base-cleaning checklist); mutually exclusive with cleaning_service_id.
  section_code text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Foreign-key lookups for reads, completion checks and parent deletes.
create index if not exists cleaning_services_cleaning_id_idx on cleaning_services (cleaning_id);
create index if not exists cleaning_services_service_id_idx on cleaning_services (service_id);
create index if not exists photos_cleaning_id_idx on photos (cleaning_id);
create index if not exists photos_cleaning_service_id_idx on photos (cleaning_service_id);
create index if not exists photos_section_code_idx on photos (cleaning_id, section_code);

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
  general_cleaning boolean not null default false,
  photo_report_enabled boolean not null default false,
  other_request text,
  requested_date date not null,
  requested_time text not null,
  cabinets_rule text,
  personal_items_rule text,
  do_not_touch text,
  base_price integer not null,
  extras_price integer not null,
  total_price integer not null,
  status text not null default 'new',
  cleaning_id uuid unique references cleanings(id) on delete set null,
  created_at timestamptz not null default now()
);
