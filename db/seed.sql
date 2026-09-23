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
  ('22222222-2222-2222-2222-222222222212', 's12', 'Отнести / забрать вещи из химчистки', 12),
  ('22222222-2222-2222-2222-222222222238', 's13', 'Генеральная уборка', 13)
on conflict (code) do nothing;

-- Base-cleaning checklist catalog: grouped into 4 fixed sections (rooms, kitchen,
-- bathroom, completion). Selecting service 's1' expands into these 25 items
-- (see lib/data/cleaning-create.ts) instead of inserting a single 's1' row, so
-- new base cleanings never double up on the same work. Excluded from the flat
-- add-on catalog (getServices()) via section_code IS NOT NULL.
insert into services (id, code, title, sort_order, section_code, section_order) values
  ('22222222-2222-2222-2222-222222222213', 'base_rooms_1', 'Удалить пыль с доступных поверхностей', 13, 'rooms', 1),
  ('22222222-2222-2222-2222-222222222214', 'base_rooms_2', 'Протереть подоконники', 14, 'rooms', 2),
  ('22222222-2222-2222-2222-222222222215', 'base_rooms_3', 'Пропылесосить полы и ковры', 15, 'rooms', 3),
  ('22222222-2222-2222-2222-222222222216', 'base_rooms_4', 'Вымыть полы', 16, 'rooms', 4),
  ('22222222-2222-2222-2222-222222222217', 'base_rooms_5', 'Протереть зеркала и стеклянные поверхности', 17, 'rooms', 5),
  ('22222222-2222-2222-2222-222222222218', 'base_rooms_6', 'Собрать и вынести мусор', 18, 'rooms', 6),
  ('22222222-2222-2222-2222-222222222219', 'base_rooms_7', 'Аккуратно расставить предметы на их местах', 19, 'rooms', 7),
  ('22222222-2222-2222-2222-222222222220', 'base_rooms_8', 'Сменить постельное бельё', 20, 'rooms', 8),
  ('22222222-2222-2222-2222-222222222221', 'base_kitchen_1', 'Протереть рабочие поверхности', 21, 'kitchen', 1),
  ('22222222-2222-2222-2222-222222222222', 'base_kitchen_2', 'Очистить мойку и смеситель', 22, 'kitchen', 2),
  ('22222222-2222-2222-2222-222222222223', 'base_kitchen_3', 'Протереть фасады кухни снаружи', 23, 'kitchen', 3),
  ('22222222-2222-2222-2222-222222222224', 'base_kitchen_4', 'Протереть плиту / варочную поверхность', 24, 'kitchen', 4),
  ('22222222-2222-2222-2222-222222222225', 'base_kitchen_5', 'Протереть бытовую технику снаружи', 25, 'kitchen', 5),
  ('22222222-2222-2222-2222-222222222226', 'base_kitchen_6', 'Убрать холодильник внутри', 26, 'kitchen', 6),
  ('22222222-2222-2222-2222-222222222227', 'base_kitchen_7', 'Убрать духовку внутри', 27, 'kitchen', 7),
  ('22222222-2222-2222-2222-222222222228', 'base_kitchen_8', 'Вымыть пол', 28, 'kitchen', 8),
  ('22222222-2222-2222-2222-222222222229', 'base_bathroom_1', 'Вымыть раковину и смеситель', 29, 'bathroom', 1),
  ('22222222-2222-2222-2222-222222222230', 'base_bathroom_2', 'Очистить ванну / душевую', 30, 'bathroom', 2),
  ('22222222-2222-2222-2222-222222222231', 'base_bathroom_3', 'Очистить унитаз', 31, 'bathroom', 3),
  ('22222222-2222-2222-2222-222222222232', 'base_bathroom_4', 'Протереть зеркала', 32, 'bathroom', 4),
  ('22222222-2222-2222-2222-222222222233', 'base_bathroom_5', 'Протереть доступные поверхности', 33, 'bathroom', 5),
  ('22222222-2222-2222-2222-222222222234', 'base_bathroom_6', 'Вымыть пол', 34, 'bathroom', 6),
  ('22222222-2222-2222-2222-222222222235', 'base_completion_1', 'Проверить качество уборки', 35, 'completion', 1),
  ('22222222-2222-2222-2222-222222222236', 'base_completion_2', 'Проверить, что свет, вода и окна оставлены в согласованном состоянии', 36, 'completion', 2),
  ('22222222-2222-2222-2222-222222222237', 'base_completion_3', 'Сделать фотоотчёт, если он заказан', 37, 'completion', 3)
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
  'none',
  'none',
  '',
  ''
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
