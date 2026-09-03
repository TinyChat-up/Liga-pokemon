-- QR Quest: credenciales elegidas por el comprador.
-- Ejecutar despues de 003_master_settings.sql.
-- La contraseña nunca se guarda en claro ni se envia en metadata de Stripe.

alter table public.games
  add column if not exists master_username text;

update public.games
set master_username = game_code
where master_username is null or trim(master_username) = '';

alter table public.games
  alter column master_username set not null;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.games'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%master_token_hash%'
  loop
    execute format('alter table public.games drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

create unique index if not exists games_master_username_unique
  on public.games (lower(master_username));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.games'::regclass
      and conname = 'games_master_username_format'
  ) then
    alter table public.games
      add constraint games_master_username_format check (master_username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
  end if;
end;
$$;

drop function if exists public.create_game_after_purchase(text, text, integer, text, text, text, text, text, text);

create or replace function public.create_game_after_purchase(
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_status text,
  p_game_code text,
  p_join_code text,
  p_master_username text,
  p_master_password text,
  p_buyer_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_username text := lower(trim(p_master_username));
begin
  if p_stripe_checkout_session_id is null or trim(p_stripe_checkout_session_id) = '' then
    raise exception 'stripe session is required';
  end if;
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'invalid master username';
  end if;
  if length(trim(coalesce(p_master_password, ''))) not between 12 and 80 then
    raise exception 'invalid master password';
  end if;

  select game_id into v_game_id
  from public.purchases
  where stripe_checkout_session_id = p_stripe_checkout_session_id;

  if v_game_id is not null then
    return jsonb_build_object('created', false, 'gameId', v_game_id);
  end if;

  insert into public.games (game_code, join_code, master_username, master_token_hash, status)
  values (lower(trim(p_game_code)), lower(trim(p_join_code)), v_username, public.hash_secret(trim(p_master_password)), 'active')
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

create or replace function public.login_game_master(
  p_master_username text,
  p_master_password text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
begin
  select * into v_game
  from public.games
  where master_username = lower(trim(p_master_username))
    and master_token_hash = public.hash_secret(trim(p_master_password));

  if v_game.id is null then
    raise exception 'invalid master credentials';
  end if;

  return jsonb_build_object(
    'gameCode', v_game.game_code,
    'masterToken', trim(p_master_password)
  );
end;
$$;

revoke all on function public.create_game_after_purchase(text, text, integer, text, text, text, text, text, text, text) from public;
revoke all on function public.login_game_master(text, text) from public;
grant execute on function public.create_game_after_purchase(text, text, integer, text, text, text, text, text, text, text) to service_role;
grant execute on function public.login_game_master(text, text) to anon, authenticated;
