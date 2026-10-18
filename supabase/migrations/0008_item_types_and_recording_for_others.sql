-- 1. Item types. Items keep their own specific names (خبز أسمر، خبز أبيض); `group_name` is the general type they
--    share (خبز), which analysis adds up. Empty means the item is its own type.
alter table public.items add column if not exists group_name text not null default ''
  check (char_length(group_name) <= 40);

-- 2. Recording an expense for another family member. The expense belongs to that member (and counts against their
--    budget); `created_by` remembers who typed it in. Either of them can edit or delete it.
alter table public.expenses add column if not exists created_by uuid default auth.uid() references public.profiles(id) on delete set null;
update public.expenses set created_by = user_id where created_by is null;
create index if not exists expenses_created_by on public.expenses (created_by);

drop policy if exists "expenses: add own" on public.expenses;
drop policy if exists "expenses: edit own" on public.expenses;
drop policy if exists "expenses: delete own" on public.expenses;

create policy "expenses: add for family" on public.expenses for insert to authenticated
  with check (
    household_id = (select public.my_household())
    and created_by = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = user_id and p.household_id = (select public.my_household()) and p.active)
  );
create policy "expenses: edit own or recorded" on public.expenses for update to authenticated
  using (household_id = (select public.my_household()) and (user_id = (select auth.uid()) or created_by = (select auth.uid())))
  with check (
    household_id = (select public.my_household())
    and (user_id = (select auth.uid()) or created_by = (select auth.uid()))
    and exists (select 1 from public.profiles p where p.id = user_id and p.household_id = (select public.my_household()))
  );
create policy "expenses: delete own or recorded" on public.expenses for delete to authenticated
  using (household_id = (select public.my_household()) and (user_id = (select auth.uid()) or created_by = (select auth.uid())));

drop policy if exists "receipt lines: add own" on public.expense_items;
drop policy if exists "receipt lines: edit own" on public.expense_items;
drop policy if exists "receipt lines: remove own" on public.expense_items;

create policy "receipt lines: add own or recorded" on public.expense_items for insert to authenticated
  with check (
    household_id = (select public.my_household())
    and exists (select 1 from public.expenses e where e.id = expense_id and (e.user_id = (select auth.uid()) or e.created_by = (select auth.uid())))
    and exists (select 1 from public.categories c where c.id = category_id and c.household_id = (select public.my_household()))
  );
create policy "receipt lines: edit own or recorded" on public.expense_items for update to authenticated
  using (household_id = (select public.my_household())
    and exists (select 1 from public.expenses e where e.id = expense_id and (e.user_id = (select auth.uid()) or e.created_by = (select auth.uid()))))
  with check (household_id = (select public.my_household())
    and exists (select 1 from public.expenses e where e.id = expense_id and (e.user_id = (select auth.uid()) or e.created_by = (select auth.uid()))));
create policy "receipt lines: remove own or recorded" on public.expense_items for delete to authenticated
  using (household_id = (select public.my_household())
    and exists (select 1 from public.expenses e where e.id = expense_id and (e.user_id = (select auth.uid()) or e.created_by = (select auth.uid()))));
