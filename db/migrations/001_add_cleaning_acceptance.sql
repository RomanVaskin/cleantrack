alter table cleanings
  add column if not exists accepted_at timestamptz;
