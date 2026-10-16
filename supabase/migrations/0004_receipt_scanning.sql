-- What a shop prints for an item (e.g. "FAIRY LEMON 750ML") mapped to the family's item, learned from corrections
create table public.item_aliases (
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  alias         text not null check (char_length(alias) between 1 and 120), -- normalised: lower case, single spaces
  item_id       uuid not null references public.items(id) on delete cascade,
  updated_at    timestamptz not null default now(),
  primary key (household_id, alias)
);
create index item_aliases_item on public.item_aliases (item_id);

alter table public.item_aliases enable row level security;
create policy "aliases: family" on public.item_aliases for all to authenticated
  using (household_id = (select public.my_household()))
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.items i where i.id = item_id and i.household_id = (select public.my_household()))
  );

-- One row per receipt read, used for the daily limit. Rows can be added and read, never changed or removed.
create table public.receipt_scans (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  provider      text not null,
  model         text not null,
  ok            boolean not null,
  created_at    timestamptz not null default now()
);
create index receipt_scans_household_time on public.receipt_scans (household_id, created_at desc);
create index receipt_scans_user on public.receipt_scans (user_id);

alter table public.receipt_scans enable row level security;
create policy "scans: read family" on public.receipt_scans for select to authenticated
  using (household_id = (select public.my_household()));
create policy "scans: log own" on public.receipt_scans for insert to authenticated
  with check (household_id = (select public.my_household()) and user_id = (select auth.uid()));
