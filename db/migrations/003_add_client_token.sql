alter table cleanings
  add column if not exists client_token text unique;
