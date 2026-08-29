-- Liga Terraza 27: final persistente y herramientas de rescate para el evento.
-- Es idempotente y puede ejecutarse completo desde el editor SQL de Supabase.

create table if not exists public.final_rewards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.profiles(id) on delete cascade,
  reward_name text not null,
  completed_at timestamptz not null default now()
);

create table if not exists public.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  reason text not null,
  token_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists admin_adjustments_player_created_idx
  on public.admin_adjustments (player_id, created_at desc);

alter table public.final_rewards enable row level security;
alter table public.admin_adjustments enable row level security;

drop policy if exists "Final rewards are readable during the game" on public.final_rewards;
create policy "Final rewards are readable during the game"
  on public.final_rewards for select
  to anon, authenticated
  using (true);

grant select on public.final_rewards to anon, authenticated;
revoke all on public.admin_adjustments from anon, authenticated;

create or replace function public.complete_elite_four(
  p_player_id uuid,
  p_reward_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_reward text;
begin
  if (select count(distinct station_id) from public.game_progress where player_id = p_player_id) < 12 then
    raise exception 'the 12 route encounters must be completed first';
  end if;

  select reward_name into v_existing_reward
  from public.final_rewards
  where player_id = p_player_id;

  if v_existing_reward is not null then
    return jsonb_build_object('awarded', false, 'reward', v_existing_reward);
  end if;

  insert into public.final_rewards (player_id, reward_name)
  values (p_player_id, p_reward_name)
  on conflict (player_id) do nothing
  returning reward_name into v_existing_reward;

  if v_existing_reward is null then
    select reward_name into v_existing_reward from public.final_rewards where player_id = p_player_id;
    return jsonb_build_object('awarded', false, 'reward', v_existing_reward);
  end if;

  return jsonb_build_object('awarded', true, 'reward', v_existing_reward);
end;
$$;

create or replace function public.admin_recover_player(
  p_admin_code text,
  p_player_id uuid,
  p_action text,
  p_reason text,
  p_token_delta integer default 0,
  p_station_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_admin_code <> '8128' then
    raise exception 'invalid administrator code';
  end if;

  if p_action not in ('heal', 'tokens', 'unstick') then
    raise exception 'unsupported administrator action';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'an audit reason is required';
  end if;

  if p_action = 'heal' then
    update public.profiles set energy = 100, updated_at = now() where id = p_player_id;
  elsif p_action = 'tokens' then
    if abs(p_token_delta) > 20 then
      raise exception 'token adjustment is outside the allowed range';
    end if;
    update public.profiles
      set tokens = greatest(0, tokens + p_token_delta), updated_at = now()
      where id = p_player_id;
  else
    delete from public.team_invites
      where status = 'pending'
        and (from_player_id = p_player_id or to_player_id = p_player_id);
    if p_station_id is not null and not exists (
      select 1 from public.game_progress
      where player_id = p_player_id and station_id = p_station_id
    ) then
      delete from public.question_history
      where player_id = p_player_id and station_id = p_station_id;
    end if;
  end if;

  insert into public.admin_adjustments (player_id, action, reason, token_delta)
  values (p_player_id, p_action, trim(p_reason), p_token_delta);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.complete_elite_four(uuid, text) from public;
revoke all on function public.admin_recover_player(text, uuid, text, text, integer, text) from public;
grant execute on function public.complete_elite_four(uuid, text) to anon, authenticated;
grant execute on function public.admin_recover_player(text, uuid, text, text, integer, text) to anon, authenticated;

create or replace function public.complete_team_station(
  p_player_one_id uuid,
  p_player_two_id uuid,
  p_station_id text,
  p_reward_tokens integer,
  p_player_one_capture jsonb,
  p_player_two_capture jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_capture jsonb;
begin
  if p_player_one_id = p_player_two_id then
    raise exception 'team players must be different';
  end if;

  perform id from public.profiles
  where id in (p_player_one_id, p_player_two_id)
  order by id
  for update;

  if exists (
    select 1 from public.game_progress
    where player_id = p_player_one_id and station_id = p_station_id
  ) then
    return jsonb_build_object('awarded', false);
  end if;

  foreach v_player_id in array array[p_player_one_id, p_player_two_id]
  loop
    insert into public.game_progress (player_id, station_id, completed_at)
    values (v_player_id, p_station_id, now())
    on conflict (player_id, station_id) do nothing;

    update public.profiles
      set tokens = tokens + p_reward_tokens,
          xp = xp + 25,
          level = floor((xp + 25) / 100.0)::integer + 1,
          updated_at = now()
      where id = v_player_id;
  end loop;

  v_capture := p_player_one_capture;
  insert into public.captures (id, player_id, pokemon_id, pokemon_name, rarity, sprite_id, token_value)
  values (
    (v_capture->>'id')::uuid, p_player_one_id, (v_capture->>'pokemon_id')::integer,
    v_capture->>'pokemon_name', v_capture->>'rarity', v_capture->>'sprite_id',
    (v_capture->>'token_value')::integer
  ) on conflict (id) do nothing;

  v_capture := p_player_two_capture;
  insert into public.captures (id, player_id, pokemon_id, pokemon_name, rarity, sprite_id, token_value)
  values (
    (v_capture->>'id')::uuid, p_player_two_id, (v_capture->>'pokemon_id')::integer,
    v_capture->>'pokemon_name', v_capture->>'rarity', v_capture->>'sprite_id',
    (v_capture->>'token_value')::integer
  ) on conflict (id) do nothing;

  update public.team_invites
    set status = 'accepted'
    where station_id = p_station_id
      and status = 'pending'
      and from_player_id = p_player_one_id
      and to_player_id = p_player_two_id;

  return jsonb_build_object('awarded', true);
end;
$$;

revoke all on function public.complete_team_station(uuid, uuid, text, integer, jsonb, jsonb) from public;
grant execute on function public.complete_team_station(uuid, uuid, text, integer, jsonb, jsonb) to anon, authenticated;

create or replace function public.reset_liga27_game()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.admin_adjustments;
  delete from public.final_rewards;
  delete from public.question_history;
  delete from public.team_invites;
  delete from public.arena_matches;
  delete from public.redemptions;
  delete from public.captures;
  delete from public.game_progress;

  update public.profiles
    set evolution = null,
        level = 1,
        xp = 0,
        energy = 100,
        tokens = 0,
        updated_at = now();
end;
$$;

revoke all on function public.reset_liga27_game() from public, anon, authenticated;
