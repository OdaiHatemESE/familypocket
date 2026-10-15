-- Items (sub-categories) the family buys, each with a unit of measure
create table public.items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  category_id   uuid not null references public.categories(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  unit          text not null default 'حبة' check (char_length(unit) between 1 and 20),
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (category_id, name)
);
create index items_household on public.items (household_id);

-- Lines of a receipt: what was bought, how much, and the line total
create table public.expense_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  expense_id    uuid not null references public.expenses(id) on delete cascade,
  item_id       uuid references public.items(id) on delete set null,
  category_id   uuid not null references public.categories(id) on delete cascade,
  name          text not null,  -- snapshot, so history survives renaming
  unit          text not null,
  quantity      numeric(12,3) not null check (quantity > 0),
  amount        numeric(12,2) not null check (amount >= 0),
  created_at    timestamptz not null default now()
);
create index expense_items_expense on public.expense_items (expense_id);
create index expense_items_household on public.expense_items (household_id);
create index expense_items_item on public.expense_items (item_id);
create index expense_items_category on public.expense_items (category_id);

alter table public.items enable row level security;
alter table public.expense_items enable row level security;

create policy "items: family" on public.items for all to authenticated
  using (household_id = (select public.my_household()))
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.categories c where c.id = category_id and c.household_id = (select public.my_household()))
  );

-- Lines are visible to the family; only the person who recorded the receipt can change its lines
create policy "receipt lines: read family" on public.expense_items for select to authenticated
  using (household_id = (select public.my_household()));
create policy "receipt lines: add own" on public.expense_items for insert to authenticated
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid()))
    and exists (select 1 from public.categories c where c.id = category_id and c.household_id = (select public.my_household()))
  );
create policy "receipt lines: edit own" on public.expense_items for update to authenticated
  using (household_id = (select public.my_household()) and exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid())))
  with check (household_id = (select public.my_household()) and exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid())));
create policy "receipt lines: remove own" on public.expense_items for delete to authenticated
  using (household_id = (select public.my_household()) and exists (select 1 from public.expenses e where e.id = expense_id and e.user_id = (select auth.uid())));

alter publication supabase_realtime add table public.items, public.expense_items;
