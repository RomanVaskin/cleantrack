alter table services
  add column if not exists section_code text,
  add column if not exists section_order integer;

alter table photos
  add column if not exists section_code text;

create index if not exists photos_section_code_idx on photos (cleaning_id, section_code);
