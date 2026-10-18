-- Start over from the app: the account owner can clear one month's spending, or everything the family has
-- recorded. Members, logins and the family itself always stay.

-- The categories every new family starts with, in one place for registering and for starting over
create or replace function private.seed_default_categories(p_house uuid)
returns void language sql security definer set search_path = ''
as $$
  insert into public.categories (household_id, name, icon, color, monthly_budget, sort) values
    (p_house, 'متطلبات المنزل', 'home-variant-outline',  '#2E5EAA', 3000, 1),
    (p_house, 'مصاريف السيارة', 'car-outline',           '#C9822B', 1200, 2),
    (p_house, 'رسوم المدرسة',   'school-outline',        '#0F7B6C', 2500, 3),
    (p_house, 'مصاريف الأطفال', 'baby-face-outline',     '#B23A58', 1000, 4),
    (p_house, 'الفواتير',       'lightning-bolt-outline','#6B4FA3', 800, 5);
$$;
revoke execute on function private.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.register_family(p_username text, p_password text, p_display_name text, p_family_name text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_user uuid; v_house uuid;
begin
  if char_length(trim(coalesce(p_display_name, ''))) = 0 then raise exception 'NAME_REQUIRED' using hint = 'اكتب اسمك'; end if;
  insert into public.households (name) values (coalesce(nullif(trim(p_family_name), ''), 'عائلتي')) returning id into v_house;
  v_user := private.create_auth_user(p_username, p_password, trim(p_display_name));
  insert into public.profiles (id, household_id, username, display_name, color, role)
  values (v_user, v_house, lower(trim(p_username)), trim(p_display_name), '#2E5EAA', 'owner');
  perform private.seed_default_categories(v_house);
end $$;

-- p_scope 'month': that month's expenses and receipts, and that month's set-asides. A cheque paid that month
--                  goes back to waiting. Budgets, salaries, commitments and categories stay.
-- p_scope 'all':   every expense, receipt, budget, salary, commitment, item and category; categories start
--                  again from the defaults.
create or replace function public.reset_family_data(p_scope text, p_month text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_house uuid := public.my_household(); v_from date; v_to date;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner' and active) then
    raise exception 'OWNER_ONLY' using hint = 'صاحب الحساب بس بيقدر يفضّي البيانات';
  end if;
  if p_scope = 'month' then
    if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'BAD_MONTH' using hint = 'الشهر غير صحيح'; end if;
    v_from := to_date(p_month || '-01', 'YYYY-MM-DD');
    v_to := (v_from + interval '1 month')::date;
    delete from public.expenses where household_id = v_house and spent_on >= v_from and spent_on < v_to;
    delete from public.commitment_reserves where household_id = v_house and month = p_month;
  elsif p_scope = 'all' then
    delete from public.expenses where household_id = v_house;
    delete from public.commitment_reserves where household_id = v_house;
    delete from public.commitment_payments where household_id = v_house;
    delete from public.fixed_expenses where household_id = v_house;
    delete from public.member_incomes where household_id = v_house;
    delete from public.member_category_budgets where household_id = v_house;
    delete from public.member_budgets where household_id = v_house;
    delete from public.item_aliases where household_id = v_house;
    delete from public.items where household_id = v_house;
    delete from public.categories where household_id = v_house;
    perform private.seed_default_categories(v_house);
  else
    raise exception 'BAD_SCOPE';
  end if;
end $$;

revoke execute on function public.reset_family_data(text, text) from public, anon;
grant execute on function public.reset_family_data(text, text) to authenticated;
