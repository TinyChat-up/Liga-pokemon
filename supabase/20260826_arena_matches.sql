alter table public.arena_matches
  add column if not exists station_id text,
  add column if not exists winner_player_id uuid references public.profiles(id),
  add column if not exists loser_player_id uuid references public.profiles(id),
  add column if not exists resolved_at timestamptz;

create unique index if not exists arena_matches_player_station_unique
  on public.arena_matches (player_one_id, station_id)
  where station_id is not null;

create or replace function public.resolve_arena_match(
  p_player_one_id uuid,
  p_player_two_id uuid,
  p_station_id text,
  p_challenge text,
  p_winner_player_id uuid,
  p_loser_player_id uuid,
  p_reward_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  if p_winner_player_id not in (p_player_one_id, p_player_two_id) then
    raise exception 'winner must be one of the arena players';
  end if;

  if p_loser_player_id not in (p_player_one_id, p_player_two_id) then
    raise exception 'loser must be one of the arena players';
  end if;

  if p_winner_player_id = p_loser_player_id then
    raise exception 'winner and loser must be different players';
  end if;

  if p_station_id is not null then
    select id
      into v_match_id
      from public.arena_matches
      where player_one_id = p_player_one_id
        and station_id = p_station_id
      limit 1;

    if v_match_id is not null then
      return jsonb_build_object('awarded', false, 'match_id', v_match_id);
    end if;
  end if;

  insert into public.arena_matches (
    player_one_id,
    player_two_id,
    station_id,
    challenge,
    reward_tokens,
    winner_player_id,
    loser_player_id,
    resolved_at
  )
  values (
    p_player_one_id,
    p_player_two_id,
    p_station_id,
    p_challenge,
    p_reward_tokens,
    p_winner_player_id,
    p_loser_player_id,
    now()
  )
  returning id into v_match_id;

  update public.profiles
    set tokens = tokens + p_reward_tokens,
        updated_at = now()
    where id = p_winner_player_id;

  update public.profiles
    set energy = 0,
        updated_at = now()
    where id = p_loser_player_id;

  return jsonb_build_object('awarded', true, 'match_id', v_match_id);
end;
$$;

grant execute on function public.resolve_arena_match(
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid,
  integer
) to anon, authenticated;
