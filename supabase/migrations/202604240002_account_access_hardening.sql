do $$
begin
  if to_regclass('public.profiles') is null then
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      display_name text not null default '',
      created_at timestamptz not null default now()
    );
  else
    alter table public.profiles add column if not exists id uuid;
    alter table public.profiles add column if not exists display_name text not null default '';
    alter table public.profiles add column if not exists created_at timestamptz not null default now();

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'user_id'
    ) then
      update public.profiles
      set id = user_id
      where id is null;
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_id'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_self_select_user_id'
    ) then
      execute 'create policy profiles_self_select_user_id on public.profiles for select to authenticated using (user_id = auth.uid())';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_self_insert_user_id'
    ) then
      execute 'create policy profiles_self_insert_user_id on public.profiles for insert to authenticated with check (user_id = auth.uid())';
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'profiles'
        and policyname = 'profiles_self_update_user_id'
    ) then
      execute 'create policy profiles_self_update_user_id on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())';
    end if;
  end if;
end $$;

create unique index if not exists profiles_id_unique_idx
  on public.profiles (id)
  where id is not null;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_self_select_id'
  ) then
    create policy profiles_self_select_id
      on public.profiles for select to authenticated
      using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_self_insert_id'
  ) then
    create policy profiles_self_insert_id
      on public.profiles for insert to authenticated
      with check (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_self_update_id'
  ) then
    create policy profiles_self_update_id
      on public.profiles for update to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;

  if to_regclass('public.session_characters') is not null and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'session_characters'
      and policyname = 'session_characters_member_insert_own'
  ) then
    create policy session_characters_member_insert_own
      on public.session_characters for insert to authenticated
      with check (
        public.is_session_member(session_id)
        and owner_user_id = auth.uid()
      );
  end if;
end $$;

notify pgrst, 'reload schema';
