alter table cleanings
  add column if not exists completed_at timestamptz;
