-- مصاريفي / FamilyPocket — schema, security and account functions
-- Every row belongs to a household; Row Level Security limits each user to their own household.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- ───────────── Tables ─────────────
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    text not null default 'AED',
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  household_id  uuid not null references public.households(id) on delete cascade,
  username      text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name  text not null check (char_length(display_name) between 1 and 40),
  color         text not null default '#2E5EAA',
  role          text not null default 'member' check (role in ('owner', 'member')),
  created_at    timestamptz not null default now()
);

create or replace function public.my_household()
returns uuid language sql stable security definer set search_path = ''
as $$ select household_id from public.profiles where id = auth.uid() $$;

create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null default public.my_household() references public.households(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 40),
  icon            text not null,
  color           text not null,
  monthly_budget  numeric(12,2) not null default 0 check (monthly_budget >= 0),
  sort            int not null default 0,
  created_at      timestamptz not null default now()
);

create table public.fixed_expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  category_id   uuid not null references public.categories(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  amount        numeric(12,2) not null check (amount > 0),
  due_day       int not null check (due_day between 1 and 31),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null default public.my_household() references public.households(id) on delete cascade,
  user_id       uuid default auth.uid() references public.profiles(id) on delete set null,
  category_id   uuid not null references public.categories(id) on delete cascade,
  fixed_id      uuid references public.fixed_expenses(id) on delete set null,
  amount        numeric(12,2) not null check (amount > 0),
  note          text not null default '',
  spent_on      date not null default current_date,
  created_at    timestamptz not null default now()
);

create index expenses_household_date on public.expenses (household_id, spent_on desc);
create index categories_household on public.categories (household_id);
create index fixed_household on public.fixed_expenses (household_id);
create index profiles_household on public.profiles (household_id);
-- A fixed obligation can only be marked paid once per month
create unique index expenses_fixed_once_per_month
  on public.expenses (fixed_id, (extract(year from spent_on) * 100 + extract(month from spent_on)))
  where fixed_id is not null;

-- ───────────── Row Level Security ─────────────
alter table public.households     enable row level security;
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.expenses       enable row level security;

create policy "household: read own"   on public.households for select to authenticated using (id = public.my_household());
create policy "household: rename own" on public.households for update to authenticated using (id = public.my_household()) with check (id = public.my_household());

create policy "profiles: read family" on public.profiles for select to authenticated using (household_id = public.my_household());
create policy "profiles: edit self"   on public.profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and household_id = public.my_household());

-- Every family member can manage categories, budgets and fixed obligations
create policy "categories: family" on public.categories for all to authenticated
  using (household_id = public.my_household()) with check (household_id = public.my_household());
create policy "fixed: family" on public.fixed_expenses for all to authenticated
  using (household_id = public.my_household()) with check (household_id = public.my_household());

-- Everyone sees the family's expenses; each person adds, edits and deletes their own
create policy "expenses: read family" on public.expenses for select to authenticated using (household_id = public.my_household());
create policy "expenses: add own" on public.expenses for insert to authenticated
  with check (household_id = public.my_household() and user_id = auth.uid());
create policy "expenses: edit own" on public.expenses for update to authenticated
  using (household_id = public.my_household() and user_id = auth.uid())
  with check (household_id = public.my_household() and user_id = auth.uid());
create policy "expenses: delete own" on public.expenses for delete to authenticated
  using (household_id = public.my_household() and user_id = auth.uid());

-- ───────────── Accounts (username + password) ─────────────
-- Usernames map to an internal address; nothing is ever emailed.
create or replace function private.login_email(p_username text)
returns text language sql immutable as $$ select lower(trim(p_username)) || '@familypocket.local' $$;

create or replace function private.create_auth_user(p_username text, p_password text, p_display_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := private.login_email(p_username);
begin
  if lower(trim(p_username)) !~ '^[a-z0-9_.]{3,24}$' then
    raise exception 'USERNAME_INVALID' using hint = 'اسم المستخدم من 3 إلى 24 حرف إنجليزي أو رقم';
  end if;
  if char_length(p_password) < 6 then
    raise exception 'PASSWORD_SHORT' using hint = 'كلمة المرور لازم تكون 6 خانات أو أكثر';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'USERNAME_TAKEN' using hint = 'اسم المستخدم مستخدم، جرّب اسم ثاني';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_display_name), now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end $$;

revoke all on function private.create_auth_user(text, text, text) from public, anon, authenticated;

-- Create a new family with its owner account and starter categories (called before sign-in)
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
  insert into public.categories (household_id, name, icon, color, monthly_budget, sort) values
    (v_house, 'متطلبات المنزل', 'home-variant-outline', '#2E5EAA', 3000, 1),
    (v_house, 'مصاريف السيارة', 'car-outline',          '#C9822B', 1200, 2),
    (v_house, 'رسوم المدرسة',   'school-outline',       '#0F7B6C', 2500, 3),
    (v_house, 'مصاريف الأطفال', 'baby-face-outline',    '#B23A58', 1000, 4),
    (v_house, 'الفواتير',       'lightning-bolt-outline','#6B4FA3', 800, 5);
end $$;

-- Add a family member with their own username and password
create or replace function public.add_family_member(p_username text, p_password text, p_display_name text, p_color text default '#B23A58')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_house uuid := public.my_household(); v_user uuid;
begin
  if v_house is null then raise exception 'NOT_SIGNED_IN'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) = 0 then raise exception 'NAME_REQUIRED' using hint = 'اكتب اسم الشخص'; end if;
  v_user := private.create_auth_user(p_username, p_password, trim(p_display_name));
  insert into public.profiles (id, household_id, username, display_name, color, role)
  values (v_user, v_house, lower(trim(p_username)), trim(p_display_name), coalesce(p_color, '#B23A58'), 'member');
  return v_user;
end $$;

-- Owner sets a new password for a family member
create or replace function public.set_member_password(p_user uuid, p_password text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'OWNER_ONLY' using hint = 'صاحب الحساب بس بيقدر يغيّر كلمة مرور غيره';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and household_id = public.my_household()) then
    raise exception 'NOT_IN_FAMILY';
  end if;
  if char_length(p_password) < 6 then raise exception 'PASSWORD_SHORT' using hint = 'كلمة المرور لازم تكون 6 خانات أو أكثر'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- Owner removes a member; their past expenses stay in the family's history
create or replace function public.remove_family_member(p_user uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') then
    raise exception 'OWNER_ONLY' using hint = 'صاحب الحساب بس بيقدر يحذف أفراد';
  end if;
  if p_user = auth.uid() then raise exception 'CANNOT_REMOVE_SELF' using hint = 'ما بتقدر تحذف حسابك'; end if;
  if not exists (select 1 from public.profiles where id = p_user and household_id = public.my_household()) then
    raise exception 'NOT_IN_FAMILY';
  end if;
  delete from auth.users where id = p_user;
end $$;

revoke all on function public.register_family(text, text, text, text) from public;
grant execute on function public.register_family(text, text, text, text) to anon, authenticated;
revoke all on function public.add_family_member(text, text, text, text) from public, anon;
grant execute on function public.add_family_member(text, text, text, text) to authenticated;
revoke all on function public.set_member_password(uuid, text) from public, anon;
grant execute on function public.set_member_password(uuid, text) to authenticated;
revoke all on function public.remove_family_member(uuid) from public, anon;
grant execute on function public.remove_family_member(uuid) to authenticated;
revoke all on function public.my_household() from public, anon;
grant execute on function public.my_household() to authenticated;

-- ───────────── Realtime: family members see each other's changes instantly ─────────────
alter publication supabase_realtime add table public.expenses, public.categories, public.fixed_expenses, public.profiles;
