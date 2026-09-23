begin;

alter table orders
  add column if not exists general_cleaning boolean not null default false;

insert into services (id, code, title, sort_order)
values ('22222222-2222-2222-2222-222222222238', 's13', 'Генеральная уборка', 13)
on conflict (code) do update
set title = excluded.title,
    sort_order = excluded.sort_order;

commit;
