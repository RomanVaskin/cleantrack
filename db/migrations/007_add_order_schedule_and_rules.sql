alter table orders
  add column if not exists requested_date date,
  add column if not exists requested_time text,
  add column if not exists cabinets_rule text,
  add column if not exists personal_items_rule text,
  add column if not exists do_not_touch text;

alter table cleanings
  add column if not exists requested_date date,
  add column if not exists requested_time text;
