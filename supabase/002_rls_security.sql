-- QR Quest: seguridad, RLS y funciones atomicas.
-- Ejecutar despues de 001_schema.sql.

-- Retira el antiguo seed si llego a ejecutarse. No afecta a partidas compradas.
delete from public.games where game_code = 'demo-quest';

create or replace function public.hash_secret(p_secret text)
returns text
language sql
immutable
strict
as $$
  select encode(extensions.digest(p_secret, 'sha256'::text), 'hex');
$$;

create or replace function public.is_game_admin(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.games g
    where g.id = p_game_id
      and g.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.game_admins ga
    where ga.game_id = p_game_id
      and ga.user_id = auth.uid()
  );
$$;

create or replace function public.game_session_exists(p_game_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.games
    where game_code = lower(trim(p_game_code))
       or join_code = lower(trim(p_game_code))
  );
$$;

create or replace function public.assert_game_master(
  p_game_code text,
  p_master_token text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  select id into v_game_id
  from public.games
  where (game_code = lower(trim(p_game_code)) or join_code = lower(trim(p_game_code)))
    and master_token_hash = public.hash_secret(trim(p_master_token));

  if v_game_id is null then
    raise exception 'invalid game master';
  end if;

  return v_game_id;
end;
$$;

create or replace function public.seed_default_checkpoints(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station record;
begin
  for v_station in
    select *
    from (values
      (1, 'trainer-1', 'trainer'::public.checkpoint_kind, 'Ciudad Plateada', 2),
      (2, 'rocket-1', 'team_rocket'::public.checkpoint_kind, 'Monte Moon', 3),
      (3, 'trainer-2', 'trainer'::public.checkpoint_kind, 'Ciudad Celeste', 2),
      (4, 'trainer-3', 'trainer'::public.checkpoint_kind, 'Ciudad Carmin', 2),
      (5, 'trainer-4', 'trainer'::public.checkpoint_kind, 'Ciudad Azulona', 2),
      (6, 'rocket-2', 'team_rocket'::public.checkpoint_kind, 'Casino Rocket', 3),
      (7, 'trainer-5', 'trainer'::public.checkpoint_kind, 'Ciudad Fucsia', 2),
      (8, 'trainer-6', 'trainer'::public.checkpoint_kind, 'Ciudad Azafran', 2),
      (9, 'rocket-3', 'team_rocket'::public.checkpoint_kind, 'Silph S.A.', 3),
      (10, 'trainer-7', 'trainer'::public.checkpoint_kind, 'Isla Canela', 2),
      (11, 'trainer-8', 'trainer'::public.checkpoint_kind, 'Ciudad Verde', 2),
      (12, 'rocket-4', 'team_rocket'::public.checkpoint_kind, 'Ruta Victoria', 3)
    ) as station(sort_order, station_id, kind, title, reward_tokens)
  loop
    insert into public.checkpoints (
      game_id,
      public_token,
      sort_order,
      station_id,
      kind,
      title,
      reward_tokens
    )
    values (
      p_game_id,
      replace(translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=', ''),
      v_station.sort_order,
      v_station.station_id,
      v_station.kind,
      v_station.title,
      v_station.reward_tokens
    )
    on conflict (game_id, station_id) do nothing;
  end loop;
end;
$$;

create or replace function public.claim_game_master(
  p_game_code text,
  p_master_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(trim(p_game_code));
  v_token text := trim(p_master_token);
  v_hash text := public.hash_secret(trim(p_master_token));
  v_game_id uuid;
  v_existing_hash text;
begin
  if v_code !~ '^[a-z0-9][a-z0-9-]{3,39}$' then
    raise exception 'invalid game code';
  end if;

  if length(v_token) < 12 then
    raise exception 'invalid master token';
  end if;

  insert into public.games (game_code, join_code, master_token_hash, status)
  values (v_code, v_code, v_hash, 'active')
  on conflict (game_code) do nothing
  returning id into v_game_id;

  if v_game_id is not null then
    insert into public.game_settings (game_id) values (v_game_id) on conflict do nothing;
    perform public.seed_default_checkpoints(v_game_id);
    return jsonb_build_object('claimed', true, 'gameId', v_game_id, 'masterToken', v_token);
  end if;

  select id, master_token_hash into v_game_id, v_existing_hash
  from public.games
  where game_code = v_code;

  if v_existing_hash = v_hash then
    return jsonb_build_object('claimed', true, 'gameId', v_game_id, 'masterToken', v_token);
  end if;

  return jsonb_build_object('claimed', false);
end;
$$;

create or replace function public.verify_game_master(
  p_game_code text,
  p_master_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  v_game_id := public.assert_game_master(p_game_code, p_master_token);
  return jsonb_build_object(
    'claimed', true,
    'gameId', v_game_id,
    'masterToken', trim(p_master_token)
  );
end;
$$;

create or replace function public.create_game_after_purchase(
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_status text,
  p_game_code text,
  p_join_code text,
  p_master_token text,
  p_buyer_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_code text := lower(trim(p_game_code));
  v_join_code text := lower(trim(p_join_code));
begin
  if p_stripe_checkout_session_id is null or trim(p_stripe_checkout_session_id) = '' then
    raise exception 'stripe session is required';
  end if;

  select game_id into v_game_id
  from public.purchases
  where stripe_checkout_session_id = p_stripe_checkout_session_id;

  if v_game_id is not null then
    return jsonb_build_object('created', false, 'gameId', v_game_id);
  end if;

  insert into public.games (game_code, join_code, master_token_hash, status)
  values (v_code, v_join_code, public.hash_secret(trim(p_master_token)), 'active')
  returning id into v_game_id;

  insert into public.game_settings (game_id) values (v_game_id);
  perform public.seed_default_checkpoints(v_game_id);

  insert into public.purchases (
    game_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    amount,
    currency,
    status,
    buyer_email
  )
  values (
    v_game_id,
    p_stripe_checkout_session_id,
    nullif(trim(coalesce(p_stripe_payment_intent_id, '')), ''),
    p_amount,
    lower(trim(p_currency)),
    p_status,
    p_buyer_email
  );

  return jsonb_build_object('created', true, 'gameId', v_game_id);
end;
$$;

create or replace function public.register_player(
  p_game_code text,
  p_display_name text,
  p_player_code text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_player public.profiles%rowtype;
begin
  select * into v_game
  from public.games
  where game_code = lower(trim(p_game_code))
     or join_code = lower(trim(p_game_code));

  if v_game.id is null then
    raise exception 'game not found';
  end if;

  insert into public.profiles (
    game_id,
    game_code,
    player_code,
    session_token_hash,
    display_name
  )
  values (
    v_game.id,
    v_game.game_code,
    p_player_code,
    public.hash_secret(trim(p_session_token)),
    trim(regexp_replace(p_display_name, '\s+', ' ', 'g'))
  )
  returning * into v_player;

  insert into public.game_events (game_id, player_id, event_type)
  values (v_game.id, v_player.id, 'PLAYER_CREATED');

  return to_jsonb(v_player);
end;
$$;

create or replace function public.get_game_snapshot(p_game_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  select id into v_game_id
  from public.games
  where game_code = lower(trim(p_game_code))
     or join_code = lower(trim(p_game_code));

  if v_game_id is null then
    return jsonb_build_object('profiles', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'profiles', coalesce((select jsonb_agg(to_jsonb(p) order by p.display_name) from public.profiles p where p.game_id = v_game_id and p.status <> 'deleted'), '[]'::jsonb),
    'game_progress', coalesce((select jsonb_agg(to_jsonb(gp)) from public.game_progress gp where gp.game_id = v_game_id), '[]'::jsonb),
    'captures', coalesce((select jsonb_agg(to_jsonb(c)) from public.captures c where c.game_id = v_game_id and c.redeemed_at is null), '[]'::jsonb),
    'arena_matches', coalesce((select jsonb_agg(to_jsonb(am)) from public.arena_matches am where am.game_id = v_game_id), '[]'::jsonb),
    'redemptions', coalesce((select jsonb_agg(to_jsonb(r)) from public.redemptions r where r.game_id = v_game_id), '[]'::jsonb),
    'question_history', coalesce((select jsonb_agg(to_jsonb(qh) - 'selected_answer') from public.question_history qh where qh.game_id = v_game_id), '[]'::jsonb),
    'team_invites', coalesce((select jsonb_agg(to_jsonb(ti)) from public.team_invites ti where ti.game_id = v_game_id), '[]'::jsonb),
    'final_rewards', coalesce((select jsonb_agg(to_jsonb(fr)) from public.final_rewards fr where fr.game_id = v_game_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_question_shown(
  p_player_id uuid,
  p_station_id text,
  p_question_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  select game_id into v_game_id from public.profiles where id = p_player_id;
  if v_game_id is null then raise exception 'player not found'; end if;

  insert into public.question_history (game_id, player_id, station_id, question_key)
  values (v_game_id, p_player_id, p_station_id, p_question_key)
  on conflict (player_id, question_key) do nothing;

  return jsonb_build_object('recorded', true);
end;
$$;

create or replace function public.record_question_answer(
  p_player_id uuid,
  p_question_key text,
  p_selected_answer integer,
  p_is_correct boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.question_history
  set selected_answer = p_selected_answer,
      is_correct = p_is_correct
  where player_id = p_player_id
    and question_key = p_question_key;

  return jsonb_build_object('recorded', found);
end;
$$;

create or replace function public.set_player_evolution(
  p_player_id uuid,
  p_evolution text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set evolution = p_evolution
  where id = p_player_id
    and evolution is null;

  return jsonb_build_object('updated', found);
end;
$$;

create or replace function public.complete_station(
  p_player_id uuid,
  p_station_id text,
  p_reward_tokens integer,
  p_xp integer,
  p_level integer,
  p_capture_id uuid,
  p_pokemon_id integer,
  p_pokemon_name text,
  p_rarity text,
  p_sprite_id text,
  p_token_value integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.profiles%rowtype;
  v_checkpoint_id uuid;
begin
  select * into v_player from public.profiles where id = p_player_id for update;
  if v_player.id is null then raise exception 'player not found'; end if;

  if exists (select 1 from public.game_progress where player_id = p_player_id and station_id = p_station_id) then
    return jsonb_build_object('awarded', false);
  end if;

  select id into v_checkpoint_id
  from public.checkpoints
  where game_id = v_player.game_id and station_id = p_station_id;

  insert into public.game_progress (game_id, player_id, checkpoint_id, station_id)
  values (v_player.game_id, p_player_id, v_checkpoint_id, p_station_id);

  update public.profiles
  set tokens = tokens + p_reward_tokens,
      xp = greatest(xp, p_xp),
      level = greatest(level, p_level)
  where id = p_player_id;

  insert into public.token_transactions (game_id, player_id, amount, reason, source_type, source_id, idempotency_key)
  values (v_player.game_id, p_player_id, p_reward_tokens, 'QR_COMPLETED', 'checkpoint', v_checkpoint_id, 'checkpoint:' || p_player_id || ':' || p_station_id)
  on conflict (idempotency_key) do nothing;

  insert into public.captures (id, game_id, player_id, pokemon_id, pokemon_name, rarity, sprite_id, token_value, source_type, source_id)
  values (p_capture_id, v_player.game_id, p_player_id, p_pokemon_id, p_pokemon_name, p_rarity, p_sprite_id, p_token_value, 'checkpoint', v_checkpoint_id)
  on conflict (id) do nothing;

  insert into public.battle_results (game_id, player_id, checkpoint_id, won, reward_tokens, xp_reward)
  values (v_player.game_id, p_player_id, v_checkpoint_id, true, p_reward_tokens, greatest(0, p_xp - v_player.xp));

  insert into public.game_events (game_id, player_id, event_type, payload)
  values (v_player.game_id, p_player_id, 'CHECKPOINT_COMPLETED', jsonb_build_object('stationId', p_station_id));

  return jsonb_build_object('awarded', true);
end;
$$;

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
  v_player_one public.profiles%rowtype;
  v_player_two public.profiles%rowtype;
  v_capture jsonb;
begin
  if p_player_one_id = p_player_two_id then
    raise exception 'team players must be different';
  end if;

  select * into v_player_one from public.profiles where id = p_player_one_id for update;
  select * into v_player_two from public.profiles where id = p_player_two_id for update;

  if v_player_one.game_id <> v_player_two.game_id then
    raise exception 'players belong to different games';
  end if;

  if exists (select 1 from public.game_progress where player_id = p_player_one_id and station_id = p_station_id) then
    return jsonb_build_object('awarded', false);
  end if;

  perform public.complete_station(
    p_player_one_id,
    p_station_id,
    p_reward_tokens,
    v_player_one.xp + 25,
    floor((v_player_one.xp + 25) / 100.0)::integer + 1,
    (p_player_one_capture->>'id')::uuid,
    (p_player_one_capture->>'pokemon_id')::integer,
    p_player_one_capture->>'pokemon_name',
    p_player_one_capture->>'rarity',
    p_player_one_capture->>'sprite_id',
    (p_player_one_capture->>'token_value')::integer
  );

  v_capture := p_player_two_capture;
  perform public.complete_station(
    p_player_two_id,
    p_station_id,
    p_reward_tokens,
    v_player_two.xp + 25,
    floor((v_player_two.xp + 25) / 100.0)::integer + 1,
    (v_capture->>'id')::uuid,
    (v_capture->>'pokemon_id')::integer,
    v_capture->>'pokemon_name',
    v_capture->>'rarity',
    v_capture->>'sprite_id',
    (v_capture->>'token_value')::integer
  );

  update public.team_invites
  set status = 'accepted'
  where game_id = v_player_one.game_id
    and station_id = p_station_id
    and status = 'pending'
    and from_player_id = p_player_one_id
    and to_player_id = p_player_two_id;

  return jsonb_build_object('awarded', true);
end;
$$;

create or replace function public.record_wild_capture(
  p_player_id uuid,
  p_xp integer,
  p_level integer,
  p_capture_id uuid,
  p_pokemon_id integer,
  p_pokemon_name text,
  p_rarity text,
  p_sprite_id text,
  p_token_value integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.profiles%rowtype;
begin
  select * into v_player from public.profiles where id = p_player_id for update;
  if v_player.id is null then raise exception 'player not found'; end if;

  update public.profiles
  set xp = greatest(xp, p_xp),
      level = greatest(level, p_level)
  where id = p_player_id;

  insert into public.captures (id, game_id, player_id, pokemon_id, pokemon_name, rarity, sprite_id, token_value, source_type)
  values (p_capture_id, v_player.game_id, p_player_id, p_pokemon_id, p_pokemon_name, p_rarity, p_sprite_id, p_token_value, 'wild')
  on conflict (id) do nothing;

  insert into public.game_events (game_id, player_id, event_type, payload)
  values (v_player.game_id, p_player_id, 'WILD_CAPTURE', jsonb_build_object('pokemonId', p_pokemon_id));

  return jsonb_build_object('awarded', true);
end;
$$;

create or replace function public.redeem_capture_for_tokens(p_capture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capture public.captures%rowtype;
begin
  select * into v_capture
  from public.captures
  where id = p_capture_id
  for update;

  if v_capture.id is null or v_capture.redeemed_at is not null then
    return jsonb_build_object('awarded', false);
  end if;

  update public.captures set redeemed_at = now() where id = p_capture_id;
  update public.profiles set tokens = tokens + v_capture.token_value where id = v_capture.player_id;

  insert into public.token_transactions (game_id, player_id, amount, reason, source_type, source_id, idempotency_key)
  values (v_capture.game_id, v_capture.player_id, v_capture.token_value, 'CREATURE_REDEEMED', 'capture', p_capture_id, 'capture:' || p_capture_id)
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('awarded', true);
end;
$$;

create or replace function public.spend_tokens_for_redemption(
  p_player_id uuid,
  p_item_name text,
  p_token_cost integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.profiles%rowtype;
  v_redemption_id uuid;
begin
  select * into v_player from public.profiles where id = p_player_id for update;
  if v_player.id is null then raise exception 'player not found'; end if;

  if v_player.tokens < p_token_cost then
    return jsonb_build_object('awarded', false);
  end if;

  insert into public.redemptions (game_id, player_id, item_name, token_cost)
  values (v_player.game_id, p_player_id, p_item_name, p_token_cost)
  returning id into v_redemption_id;

  update public.profiles set tokens = tokens - p_token_cost where id = p_player_id;

  insert into public.token_transactions (game_id, player_id, amount, reason, source_type, source_id, idempotency_key)
  values (v_player.game_id, p_player_id, -p_token_cost, 'REWARD_REDEEMED', 'redemption', v_redemption_id, 'redemption:' || v_redemption_id);

  return jsonb_build_object('awarded', true, 'redemptionId', v_redemption_id);
end;
$$;

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
  v_game_id uuid;
  v_match_id uuid;
begin
  select game_id into v_game_id from public.profiles where id = p_player_one_id;

  if not exists (
    select 1 from public.profiles
    where id in (p_player_two_id, p_winner_player_id, p_loser_player_id)
      and game_id = v_game_id
  ) then
    raise exception 'arena players must belong to the same game';
  end if;

  if p_winner_player_id = p_loser_player_id then
    raise exception 'winner and loser must be different players';
  end if;

  if p_station_id is not null and exists (
    select 1 from public.arena_matches
    where player_one_id = p_player_one_id and station_id = p_station_id
  ) then
    return jsonb_build_object('awarded', false);
  end if;

  insert into public.arena_matches (
    game_id,
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
    v_game_id,
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

  update public.profiles set tokens = tokens + p_reward_tokens where id = p_winner_player_id;
  update public.profiles set energy = 0 where id = p_loser_player_id;

  insert into public.token_transactions (game_id, player_id, amount, reason, source_type, source_id, idempotency_key)
  values (v_game_id, p_winner_player_id, p_reward_tokens, 'ARENA_WON', 'arena_match', v_match_id, 'arena:' || v_match_id)
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('awarded', true, 'match_id', v_match_id);
end;
$$;

create or replace function public.create_team_invite(
  p_from_player_id uuid,
  p_to_player_id uuid,
  p_station_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_invite_id uuid;
begin
  select game_id into v_game_id from public.profiles where id = p_from_player_id;

  if not exists (select 1 from public.profiles where id = p_to_player_id and game_id = v_game_id) then
    raise exception 'players belong to different games';
  end if;

  select id into v_invite_id
  from public.team_invites
  where game_id = v_game_id
    and from_player_id = p_from_player_id
    and to_player_id = p_to_player_id
    and status = 'pending'
    and (
      (p_station_id is null and station_id is null)
      or station_id = p_station_id
    )
  limit 1;

  if v_invite_id is not null then
    return jsonb_build_object('inviteId', v_invite_id);
  end if;

  insert into public.team_invites (game_id, from_player_id, to_player_id, station_id)
  values (v_game_id, p_from_player_id, p_to_player_id, p_station_id)
  returning id into v_invite_id;

  return jsonb_build_object('inviteId', v_invite_id);
end;
$$;

create or replace function public.respond_team_invite(
  p_invite_id uuid,
  p_status public.invite_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('accepted', 'declined', 'cancelled') then
    raise exception 'unsupported invite status';
  end if;

  update public.team_invites
  set status = p_status
  where id = p_invite_id
    and status = 'pending';

  return jsonb_build_object('updated', found);
end;
$$;

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
  v_player public.profiles%rowtype;
  v_existing_reward text;
begin
  select * into v_player from public.profiles where id = p_player_id for update;
  if v_player.id is null then raise exception 'player not found'; end if;

  if (select count(distinct station_id) from public.game_progress where player_id = p_player_id) < 12 then
    raise exception 'the 12 route encounters must be completed first';
  end if;

  select reward_name into v_existing_reward
  from public.final_rewards
  where player_id = p_player_id;

  if v_existing_reward is not null then
    return jsonb_build_object('awarded', false, 'reward', v_existing_reward);
  end if;

  insert into public.final_rewards (game_id, player_id, reward_name)
  values (v_player.game_id, p_player_id, p_reward_name)
  returning reward_name into v_existing_reward;

  update public.profiles set status = 'finished' where id = p_player_id;

  insert into public.game_events (game_id, player_id, event_type, payload)
  values (v_player.game_id, p_player_id, 'HALL_OF_FAME', jsonb_build_object('reward', p_reward_name));

  return jsonb_build_object('awarded', true, 'reward', v_existing_reward);
end;
$$;

create or replace function public.admin_recover_player(
  p_admin_code text,
  p_game_code text,
  p_master_token text,
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
declare
  v_game_id uuid;
begin
  v_game_id := public.assert_game_master(p_game_code, p_master_token);

  if p_action not in ('heal', 'tokens', 'unstick') then
    raise exception 'unsupported administrator action';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'an audit reason is required';
  end if;

  if not exists (select 1 from public.profiles where id = p_player_id and game_id = v_game_id) then
    raise exception 'player does not belong to this game';
  end if;

  if p_action = 'heal' then
    update public.profiles set energy = 100 where id = p_player_id;
  elsif p_action = 'tokens' then
    if abs(p_token_delta) > 20 then
      raise exception 'token adjustment is outside the allowed range';
    end if;

    update public.profiles
    set tokens = greatest(0, tokens + p_token_delta)
    where id = p_player_id;

    if p_token_delta <> 0 then
      insert into public.token_transactions (game_id, player_id, amount, reason, source_type, source_id, idempotency_key)
      values (v_game_id, p_player_id, p_token_delta, 'ADMIN_ADJUSTMENT', 'admin_adjustment', null, 'admin:' || gen_random_uuid());
    end if;
  else
    delete from public.team_invites
    where game_id = v_game_id
      and status = 'pending'
      and (from_player_id = p_player_id or to_player_id = p_player_id);

    if p_station_id is not null and not exists (
      select 1 from public.game_progress
      where player_id = p_player_id and station_id = p_station_id
    ) then
      delete from public.question_history
      where player_id = p_player_id and station_id = p_station_id;
    end if;
  end if;

  insert into public.admin_adjustments (game_id, player_id, action, reason, token_delta)
  values (v_game_id, p_player_id, p_action, trim(p_reason), p_token_delta);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.delete_player_profile(
  p_game_code text,
  p_master_token text,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  v_game_id := public.assert_game_master(p_game_code, p_master_token);
  delete from public.profiles where id = p_player_id and game_id = v_game_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reset_game_session(
  p_game_code text,
  p_master_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  v_game_id := public.assert_game_master(p_game_code, p_master_token);

  delete from public.game_events where game_id = v_game_id;
  delete from public.admin_adjustments where game_id = v_game_id;
  delete from public.final_rewards where game_id = v_game_id;
  delete from public.token_transactions where game_id = v_game_id;
  delete from public.battle_results where game_id = v_game_id;
  delete from public.encounters where game_id = v_game_id;
  delete from public.question_history where game_id = v_game_id;
  delete from public.team_invites where game_id = v_game_id;
  delete from public.arena_matches where game_id = v_game_id;
  delete from public.redemptions where game_id = v_game_id;
  delete from public.captures where game_id = v_game_id;
  delete from public.game_progress where game_id = v_game_id;
  delete from public.profiles where game_id = v_game_id;

  update public.games set updated_at = now() where id = v_game_id;
  return jsonb_build_object('ok', true);
end;
$$;

alter table public.buyer_profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_admins enable row level security;
alter table public.game_settings enable row level security;
alter table public.purchases enable row level security;
alter table public.checkpoints enable row level security;
alter table public.qr_codes enable row level security;
alter table public.profiles enable row level security;
alter table public.creatures enable row level security;
alter table public.captures enable row level security;
alter table public.token_transactions enable row level security;
alter table public.game_progress enable row level security;
alter table public.qr_scans enable row level security;
alter table public.questions enable row level security;
alter table public.question_history enable row level security;
alter table public.encounters enable row level security;
alter table public.battle_results enable row level security;
alter table public.team_invites enable row level security;
alter table public.arena_matches enable row level security;
alter table public.redemptions enable row level security;
alter table public.rewards enable row level security;
alter table public.final_rewards enable row level security;
alter table public.admin_adjustments enable row level security;
alter table public.game_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public;
grant usage on schema public to anon, authenticated;

drop policy if exists buyer_profiles_own_read on public.buyer_profiles;
drop policy if exists buyer_profiles_own_update on public.buyer_profiles;
drop policy if exists games_admin_read on public.games;
drop policy if exists games_owner_update on public.games;
drop policy if exists game_admins_admin_read on public.game_admins;
drop policy if exists game_settings_admin_read on public.game_settings;
drop policy if exists game_settings_admin_update on public.game_settings;
drop policy if exists purchases_owner_read on public.purchases;

create policy buyer_profiles_own_read
  on public.buyer_profiles for select
  to authenticated
  using (id = auth.uid());

create policy buyer_profiles_own_update
  on public.buyer_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy games_admin_read
  on public.games for select
  to authenticated
  using (public.is_game_admin(id));

create policy games_owner_update
  on public.games for update
  to authenticated
  using (public.is_game_admin(id))
  with check (public.is_game_admin(id));

create policy game_admins_admin_read
  on public.game_admins for select
  to authenticated
  using (public.is_game_admin(game_id));

create policy game_settings_admin_read
  on public.game_settings for select
  to authenticated
  using (public.is_game_admin(game_id));

create policy game_settings_admin_update
  on public.game_settings for update
  to authenticated
  using (public.is_game_admin(game_id))
  with check (public.is_game_admin(game_id));

create policy purchases_owner_read
  on public.purchases for select
  to authenticated
  using (exists (
    select 1 from public.games g
    where g.id = purchases.game_id
      and public.is_game_admin(g.id)
  ));

grant select on public.buyer_profiles to authenticated;
grant select, update on public.games to authenticated;
grant select on public.game_admins to authenticated;
grant select, update on public.game_settings to authenticated;
grant select on public.purchases to authenticated;

revoke all on function public.create_game_after_purchase(text, text, integer, text, text, text, text, text, text) from public;
grant execute on function public.create_game_after_purchase(text, text, integer, text, text, text, text, text, text) to service_role;

grant execute on function public.is_game_admin(uuid) to authenticated;
grant execute on function public.game_session_exists(text) to anon, authenticated;
grant execute on function public.verify_game_master(text, text) to anon, authenticated;
grant execute on function public.register_player(text, text, text, text) to anon, authenticated;
grant execute on function public.get_game_snapshot(text) to anon, authenticated;
grant execute on function public.record_question_shown(uuid, text, text) to anon, authenticated;
grant execute on function public.record_question_answer(uuid, text, integer, boolean) to anon, authenticated;
grant execute on function public.set_player_evolution(uuid, text) to anon, authenticated;
grant execute on function public.complete_station(uuid, text, integer, integer, integer, uuid, integer, text, text, text, integer) to anon, authenticated;
grant execute on function public.complete_team_station(uuid, uuid, text, integer, jsonb, jsonb) to anon, authenticated;
grant execute on function public.record_wild_capture(uuid, integer, integer, uuid, integer, text, text, text, integer) to anon, authenticated;
grant execute on function public.redeem_capture_for_tokens(uuid) to anon, authenticated;
grant execute on function public.spend_tokens_for_redemption(uuid, text, integer) to anon, authenticated;
grant execute on function public.resolve_arena_match(uuid, uuid, text, text, uuid, uuid, integer) to anon, authenticated;
grant execute on function public.create_team_invite(uuid, uuid, text) to anon, authenticated;
grant execute on function public.respond_team_invite(uuid, public.invite_status) to anon, authenticated;
grant execute on function public.complete_elite_four(uuid, text) to anon, authenticated;
grant execute on function public.admin_recover_player(text, text, text, uuid, text, text, integer, text) to anon, authenticated;
grant execute on function public.delete_player_profile(text, text, uuid) to anon, authenticated;
grant execute on function public.reset_game_session(text, text) to anon, authenticated;
