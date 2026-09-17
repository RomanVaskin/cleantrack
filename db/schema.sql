-- CleanTrack: standalone PostgreSQL schema for a new database.
create table if not exists cleanings (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  client_name text not null,
  address text not null,
  started_at timestamptz,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  sort_order integer not null default 0
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
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Foreign-key lookups for reads, completion checks and parent deletes.
create index if not exists cleaning_services_cleaning_id_idx on cleaning_services (cleaning_id);
create index if not exists cleaning_services_service_id_idx on cleaning_services (service_id);
create index if not exists photos_cleaning_id_idx on photos (cleaning_id);
create index if not exists photos_cleaning_service_id_idx on photos (cleaning_service_id);
