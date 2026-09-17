-- CleanTrack — минимальная схема для одной уборки.
-- Только чтение с фронтенда (anon key): без Auth, без записи с клиента.

create extension if not exists pgcrypto;

create table if not exists cleanings (
  id uuid primary key default gen_random_uuid(),
  number text,
  client_name text,
  address text,
  started_at timestamptz,
  status text,
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
  is_selected boolean not null default false,
  is_done boolean not null default false,
  note text,
  completed_at timestamptz
);

create table if not exists client_rules (
  id uuid primary key default gen_random_uuid(),
  cleaning_id uuid not null references cleanings(id) on delete cascade,
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

-- Read-only RLS: anon key используется в браузере, поэтому без явных
-- SELECT-политик и отсутствия write-политик таблицы были бы либо закрыты
-- полностью, либо (без RLS) открыты на запись всем. Так — только чтение.
alter table cleanings enable row level security;
alter table services enable row level security;
alter table cleaning_services enable row level security;
alter table client_rules enable row level security;
alter table photos enable row level security;

create policy "Public read access" on cleanings for select using (true);
create policy "Public read access" on services for select using (true);
create policy "Public read access" on cleaning_services for select using (true);
create policy "Public read access" on client_rules for select using (true);
create policy "Public read access" on photos for select using (true);

-- Storage: публичный бакет для фото уборки. Файлы сюда на этом этапе
-- не загружаются — это только подготовка бакета под будущий upload.
insert into storage.buckets (id, name, public)
values ('cleaning-photos', 'cleaning-photos', true)
on conflict (id) do nothing;

create policy "Public read access to cleaning photos"
  on storage.objects for select
  using (bucket_id = 'cleaning-photos');
