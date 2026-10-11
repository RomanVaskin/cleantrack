begin;

create table if not exists referral_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  access_token text unique not null,
  commission_percent integer not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table orders
  add column if not exists referral_partner_id uuid references referral_partners(id) on delete set null,
  add column if not exists referral_source text;

create index if not exists orders_referral_partner_id_idx on orders (referral_partner_id);

commit;
