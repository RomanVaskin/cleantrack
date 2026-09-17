begin;

-- CleanTrack — demo-данные для одной уборки (см. lib/mock-data.ts).
-- Идемпотентно: можно применять повторно без дублирования строк.

insert into cleanings (id, number, client_name, address, started_at, status)
values (
  '11111111-1111-1111-1111-111111111111',
  '124',
  'Анна',
  'Москва, ул. Ленина, 15',
  '2026-01-15 14:05:00+03',
  'in_progress'
)
on conflict (id) do nothing;

insert into services (id, code, title, sort_order) values
  ('22222222-2222-2222-2222-222222222201', 's1', 'Влажная уборка квартиры', 1),
  ('22222222-2222-2222-2222-222222222202', 's2', 'Стирка вещей', 2),
  ('22222222-2222-2222-2222-222222222203', 's3', 'Глажка вещей', 3),
  ('22222222-2222-2222-2222-222222222204', 's4', 'Сложить вещи в шкафах / гардеробной', 4),
  ('22222222-2222-2222-2222-222222222205', 's5', 'Уборка полок внутри шкафов', 5),
  ('22222222-2222-2222-2222-222222222206', 's6', 'Разложить / организовать вещи в шкафах', 6),
  ('22222222-2222-2222-2222-222222222207', 's7', 'Мойка окон', 7),
  ('22222222-2222-2222-2222-222222222208', 's8', 'Удаление сложных пятен: диваны / кресла', 8),
  ('22222222-2222-2222-2222-222222222209', 's9', 'Удаление сложных пятен: ковры', 9),
  ('22222222-2222-2222-2222-222222222210', 's10', 'Удаление сложных пятен: пол', 10),
  ('22222222-2222-2222-2222-222222222211', 's11', 'Удаление сложных пятен: мебель / фасады шкафов', 11),
  ('22222222-2222-2222-2222-222222222212', 's12', 'Отнести / забрать вещи из химчистки', 12)
on conflict (code) do nothing;

insert into cleaning_services (cleaning_id, service_id, is_selected, is_done, note)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  s.id,
  v.is_selected,
  v.is_done,
  v.note
from (
  values
    ('s1', true, true, null::text),
    ('s2', true, true, null),
    ('s3', true, true, null),
    ('s4', true, false, 'Сложить по полкам, как было'),
    ('s5', true, false, null),
    ('s6', false, false, null),
    ('s7', true, false, null),
    ('s8', true, false, null),
    ('s9', false, false, null),
    ('s10', true, false, null),
    ('s11', false, false, null),
    ('s12', false, false, null)
) as v(code, is_selected, is_done, note)
join services s on s.code = v.code
where not exists (
  select 1 from cleaning_services cs
  where cs.cleaning_id = '11111111-1111-1111-1111-111111111111'
    and cs.service_id = s.id
);

insert into client_rules (cleaning_id, cabinets_access, personal_items_access, do_not_touch, special_requests)
select
  '11111111-1111-1111-1111-111111111111',
  'selected',
  'agree',
  'Документы на рабочем столе, ноутбук, картины',
  'В детской использовать только средство клиента'
where not exists (
  select 1 from client_rules where cleaning_id = '11111111-1111-1111-1111-111111111111'
);

-- Existing local demo photos; no upload or external storage required.
insert into photos (cleaning_id, storage_path)
select '11111111-1111-1111-1111-111111111111', v.storage_path
from (
  values
    ('/photos/kitchen.png'),
    ('/photos/sink.png'),
    ('/photos/room.png')
) as v(storage_path)
where not exists (
  select 1 from photos p
  where p.cleaning_id = '11111111-1111-1111-1111-111111111111'
    and p.storage_path = v.storage_path
);

commit;
