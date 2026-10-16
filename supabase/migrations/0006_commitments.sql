-- Commitments: what comes off the salary before day-to-day spending (rent, school fees, bills,
-- transfers to family, savings). Builds on fixed_expenses, which keeps working as before for monthly items.

-- 1. What kind of commitment it is, how often it falls due, and whether its amount changes each time
alter table public.fixed_expenses
  add column kind text not null default 'bill'
    check (kind in ('rent', 'school', 'bill', 'transfer', 'saving', 'installment', 'other')),
  add column every_months int not null default 1 check (every_months in (1, 2, 3, 4, 6, 12)),
  add column variable boolean not null default false; -- amount is an estimate (electricity, water)

-- 2. Scheduled payments for commitments that are not monthly: rent cheques, school instalments
create table public.commitment_payments (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  fixed_id      uuid not null references public.fixed_expenses(id) on delete cascade,
  due_date      date not null,
  amount        numeric(12,2) not null check (amount > 0),
  method        text not null default 'cheque' check (method in ('cheque', 'transfer', 'card', 'cash')),
  reference     text not null default '' check (char_length(reference) <= 60), -- cheque number, bank
  expense_id    uuid references public.expenses(id) on delete set null,      -- set once paid / cashed
  created_at    timestamptz not null default now()
);
create index commitment_payments_household on public.commitment_payments (household_id, due_date);
create index commitment_payments_fixed on public.commitment_payments (fixed_id);
create index commitment_payments_expense on public.commitment_payments (expense_id);

-- 3. Money set aside each month towards a commitment that is paid every few months
create table public.commitment_reserves (
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  fixed_id      uuid not null references public.fixed_expenses(id) on delete cascade,
  month         text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount        numeric(12,2) not null check (amount >= 0),
  created_by    uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (fixed_id, month)
);
create index commitment_reserves_household on public.commitment_reserves (household_id);
create index commitment_reserves_created_by on public.commitment_reserves (created_by);

-- 4. Each member's monthly salary; like budgets, a month inherits the latest saved month before it
create table public.member_incomes (
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  month         text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount        numeric(12,2) not null default 0 check (amount >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, month)
);
create index member_incomes_household on public.member_incomes (household_id);

alter table public.commitment_payments enable row level security;
alter table public.commitment_reserves enable row level security;
alter table public.member_incomes enable row level security;

-- The whole family manages commitments together, as with fixed expenses
create policy "commitment payments: family" on public.commitment_payments for all to authenticated
  using (household_id = (select public.my_household()))
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.fixed_expenses f where f.id = fixed_id and f.household_id = (select public.my_household()))
    and (expense_id is null or exists (select 1 from public.expenses e where e.id = expense_id and e.household_id = (select public.my_household())))
  );
create policy "commitment reserves: family" on public.commitment_reserves for all to authenticated
  using (household_id = (select public.my_household()))
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.fixed_expenses f where f.id = fixed_id and f.household_id = (select public.my_household()))
  );
create policy "member incomes: family" on public.member_incomes for all to authenticated
  using (household_id = (select public.my_household()))
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.profiles p where p.id = user_id and p.household_id = (select public.my_household()))
  );

alter publication supabase_realtime add table public.commitment_payments, public.commitment_reserves, public.member_incomes;
