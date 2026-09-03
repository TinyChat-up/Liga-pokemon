-- QR Quest: ajustes editables por el master de cada partida.
-- Ejecutar despues de 002_rls_security.sql.

alter table public.game_settings
  add column if not exists healing_cost integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_settings'::regclass
      and conname = 'game_settings_healing_cost_check'
  ) then
    alter table public.game_settings
      add constraint game_settings_healing_cost_check check (healing_cost between 0 and 100);
  end if;
end;
$$;

create or replace function public.get_game_settings(p_game_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.game_settings%rowtype;
begin
  select gs.* into v_settings
  from public.game_settings gs
  join public.games g on g.id = gs.game_id
  where g.game_code = lower(trim(p_game_code))
     or g.join_code = lower(trim(p_game_code));

  if v_settings.game_id is null then
    raise exception 'game not found';
  end if;

  return jsonb_build_object(
    'title', v_settings.public_title,
    'healingCost', v_settings.healing_cost,
    'wildDelaySeconds', v_settings.wild_encounter_delay_seconds,
    'rewardMenu', v_settings.reward_menu,
    'finalRewards', v_settings.final_rewards
  );
end;
$$;

create or replace function public.update_game_settings(
  p_game_code text,
  p_master_token text,
  p_public_title text,
  p_healing_cost integer,
  p_wild_delay_seconds integer,
  p_reward_menu jsonb,
  p_final_rewards jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_title text := trim(regexp_replace(coalesce(p_public_title, ''), '\s+', ' ', 'g'));
begin
  v_game_id := public.assert_game_master(p_game_code, p_master_token);

  if char_length(v_title) not between 2 and 60 then
    raise exception 'the game title must have between 2 and 60 characters';
  end if;
  if p_healing_cost not between 0 and 100 then
    raise exception 'the healing cost must be between 0 and 100';
  end if;
  if p_wild_delay_seconds not between 10 and 3600 then
    raise exception 'the wild encounter delay must be between 10 and 3600 seconds';
  end if;
  if jsonb_typeof(p_reward_menu) <> 'array' or jsonb_array_length(p_reward_menu) > 20 then
    raise exception 'the reward menu must be an array with at most 20 items';
  end if;
  if jsonb_typeof(p_final_rewards) <> 'array' or jsonb_array_length(p_final_rewards) > 20 then
    raise exception 'the final rewards must be an array with at most 20 items';
  end if;

  update public.game_settings
  set public_title = v_title,
      healing_cost = p_healing_cost,
      wild_encounter_delay_seconds = p_wild_delay_seconds,
      reward_menu = p_reward_menu,
      final_rewards = p_final_rewards
  where game_id = v_game_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_game_settings(text) from public;
revoke all on function public.update_game_settings(text, text, text, integer, integer, jsonb, jsonb) from public;
grant execute on function public.get_game_settings(text) to anon, authenticated;
grant execute on function public.update_game_settings(text, text, text, integer, integer, jsonb, jsonb) to anon, authenticated;
