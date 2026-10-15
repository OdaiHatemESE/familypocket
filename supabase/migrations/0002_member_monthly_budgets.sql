-- Each family member has a total budget per month, split across categories.
-- A month with no row inherits the member's most recent earlier month (resolved in the app).
create table public.member_budgets (
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  month         text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  total         numeric(12,2) not null default 0 check (total >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, month)
);

create table public.member_category_budgets (
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  month         text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  category_id   uuid not null references public.categories(id) on delete cascade,
  amount        numeric(12,2) not null default 0 check (amount >= 0),
  primary key (user_id, month, category_id)
);

create index member_budgets_household on public.member_budgets (household_id);
create index member_category_budgets_household on public.member_category_budgets (household_id);
create index member_category_budgets_category on public.member_category_budgets (category_id);

alter table public.member_budgets enable row level security;
alter table public.member_category_budgets enable row level security;

-- Any family member can view and set budgets for anyone in the same family
create policy "member budgets: family" on public.member_budgets for all to authenticated
  using (household_id = (select public.my_household()))
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.profiles p where p.id = user_id and p.household_id = (select public.my_household()))
  );
create policy "member category budgets: family" on public.member_category_budgets for all to authenticated
  using (household_id = (select public.my_household()))
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.profiles p where p.id = user_id and p.household_id = (select public.my_household()))
    and exists (select 1 from public.categories c where c.id = category_id and c.household_id = (select public.my_household()))
  );

-- Fixed obligations are charged to a responsible member's budget
alter table public.fixed_expenses add column owner_id uuid default auth.uid() references public.profiles(id) on delete set null;
create index fixed_owner on public.fixed_expenses (owner_id);

alter publication supabase_realtime add table public.member_budgets, public.member_category_budgets;
