-- Apply to a dedicated Free-plan Supabase project before publishing.
-- No account email, password, service key or owner UUID belongs in this file.
begin;
create schema if not exists campus_private;
revoke all on schema campus_private from public, anon, authenticated;
create table if not exists campus_private.owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table campus_private.owner enable row level security;
revoke all on campus_private.owner from public, anon, authenticated;

create table if not exists public.campus_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Artist' check (char_length(display_name) between 1 and 80),
  instrument text not null default 'Exploring' check (instrument in ('Guitar','Piano','Guitar & piano','Music production','Voice','Exploring')),
  goal text not null default '' check (char_length(goal)<=1000),
  created_at timestamptz not null default now()
);
create table if not exists public.campus_work (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb check (state is null or (jsonb_typeof(state)='object' and octet_length(state::text)<=2097152)),
  revision bigint not null default 0 check (revision>=0),
  saved_at timestamptz not null default now()
);
alter table public.campus_profile enable row level security;
alter table public.campus_work enable row level security;
revoke all on public.campus_profile, public.campus_work from public, anon, authenticated;
grant select, insert, update on public.campus_profile, public.campus_work to authenticated;

-- The owner registry is inaccessible to clients. Only this fixed, read-only
-- predicate can consult it. auth.uid() is verified from Supabase's JWT.
create or replace function public.campus_is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(
  select 1 from campus_private.owner o
  join auth.sessions s on s.user_id=o.user_id
  where o.user_id=(select auth.uid())
    and s.id=((select auth.jwt())->>'session_id')::uuid
) $$;
revoke all on function public.campus_is_owner() from public, anon;
grant execute on function public.campus_is_owner() to authenticated;

drop policy if exists owner_profile on public.campus_profile;
create policy owner_profile on public.campus_profile for all to authenticated
using (user_id=(select auth.uid()) and (select public.campus_is_owner()))
with check (user_id=(select auth.uid()) and (select public.campus_is_owner()));
drop policy if exists owner_work on public.campus_work;
create policy owner_work on public.campus_work for all to authenticated
using (user_id=(select auth.uid()) and (select public.campus_is_owner()))
with check (user_id=(select auth.uid()) and (select public.campus_is_owner()));

create or replace function public.campus_bootstrap() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.campus_profile; w public.campus_work;
begin
  if not public.campus_is_owner() then raise insufficient_privilege using message='This account is not the campus owner.'; end if;
  insert into public.campus_profile(user_id) values(auth.uid()) on conflict do nothing;
  insert into public.campus_work(user_id) values(auth.uid()) on conflict do nothing;
  select * into strict p from public.campus_profile where user_id=auth.uid();
  select * into strict w from public.campus_work where user_id=auth.uid();
  return jsonb_build_object('profile',jsonb_build_object('displayName',p.display_name,'instrument',p.instrument,'goal',p.goal,'createdAt',p.created_at),'state',w.state,'revision',w.revision);
end; $$;

create or replace function public.campus_save_state(p_revision bigint,p_state jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.campus_is_owner() then raise insufficient_privilege using message='This account is not the campus owner.'; end if;
  if p_revision is null or p_revision<0 or p_state is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>2097152 then
    raise invalid_parameter_value using message='Invalid learning data.';
  end if;
  update public.campus_work set state=p_state,revision=revision+1,saved_at=now() where user_id=auth.uid() and revision=p_revision;
  if not found then raise sqlstate 'PT409' using message='Your campus changed on another device. Back up and reload before saving.'; end if;
  return jsonb_build_object('revision',p_revision+1);
end; $$;

create or replace function public.campus_update_profile(p_profile jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.campus_profile; new_name text; chosen_instrument text; chosen_goal text;
begin
  if not public.campus_is_owner() then raise insufficient_privilege using message='This account is not the campus owner.'; end if;
  if p_profile is null or jsonb_typeof(p_profile) is distinct from 'object' or jsonb_typeof(p_profile->'displayName') is distinct from 'string' then raise invalid_parameter_value using message='Enter your display name.'; end if;
  new_name=btrim(p_profile->>'displayName'); chosen_goal=coalesce(p_profile->>'goal',''); chosen_instrument=coalesce(p_profile->>'instrument','Exploring');
  if char_length(new_name) not between 1 and 80 or char_length(chosen_goal)>1000 or chosen_instrument not in ('Guitar','Piano','Guitar & piano','Music production','Voice','Exploring') then
    raise invalid_parameter_value using message='Check your name, musical interest and goal.';
  end if;
  update public.campus_profile set display_name=new_name,instrument=chosen_instrument,goal=chosen_goal where user_id=auth.uid() returning * into strict p;
  return jsonb_build_object('displayName',p.display_name,'instrument',p.instrument,'goal',p.goal,'createdAt',p.created_at);
end; $$;

revoke all on function public.campus_bootstrap(),public.campus_save_state(bigint,jsonb),public.campus_update_profile(jsonb) from public, anon;
grant execute on function public.campus_bootstrap(),public.campus_save_state(bigint,jsonb),public.campus_update_profile(jsonb) to authenticated;
commit;
