alter table cleanings
  add column if not exists photo_report_enabled boolean not null default false;

alter table orders
  add column if not exists cleaning_id uuid unique
    references cleanings(id) on delete set null;
