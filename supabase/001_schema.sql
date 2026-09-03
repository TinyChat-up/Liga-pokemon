-- QR Quest: esquema base reconstruible desde cero.
-- Ejecutar primero en un proyecto Supabase vacio.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.game_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type public.player_status as enum ('active', 'knocked_out', 'finished', 'deleted');
create type public.checkpoint_kind as enum ('trainer', 'team_rocket', 'final', 'arena', 'wild');
create type public.qr_code_kind as enum ('player_link', 'master_link', 'checkpoint', 'final', 'arena');
create type public.encounter_status as enum ('started', 'answered', 'won', 'lost', 'abandoned');
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'expired');

create table public.buyer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  game_code text not null unique,
  join_code text not null unique,
  master_token_hash text not null unique,
  title text not null default 'QR Quest',
  status public.game_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_game_code_format check (game_code ~ '^[a-z0-9][a-z0-9-]{3,39}$'),
  constraint games_join_code_format check (join_code ~ '^[a-z0-9][a-z0-9-]{3,39}$')
);

create table public.game_admins (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (game_id, user_id),
  constraint game_admins_role_check check (role in ('owner', 'manager'))
);

create table public.game_settings (
  game_id uuid primary key references public.games(id) on delete cascade,
  public_title text not null default 'QR Quest',
  player_limit integer,
  route_order_mode text not null default 'required',
  wild_encounter_delay_seconds integer not null default 15,
  reward_menu jsonb not null default '[
    {"id":"beer","label":"Cerveza","cost":2},
    {"id":"shot","label":"Chupito","cost":3},
    {"id":"food","label":"Extra BBQ","cost":4},
    {"id":"drink","label":"Copa","cost":6}
  ]'::jsonb,
  final_rewards jsonb not null default '["Extra BBQ", "Prioridad en la barra", "Reto campeon"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_settings_order_mode_check check (route_order_mode in ('required', 'free')),
  constraint game_settings_wild_delay_check check (wild_encounter_delay_seconds between 10 and 3600)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  game_id uuid unique references public.games(id) on delete restrict,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text unique,
  amount integer not null,
  currency text not null default 'eur',
  status text not null,
  buyer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_amount_check check (amount >= 0)
);

create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  public_token text not null unique,
  sort_order integer not null,
  station_id text not null,
  kind public.checkpoint_kind not null,
  title text not null,
  reward_tokens integer not null default 2,
  xp_reward integer not null default 25,
  requires_previous boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, station_id),
  unique (game_id, sort_order),
  constraint checkpoints_token_format check (public_token ~ '^[A-Za-z0-9_-]{12,80}$'),
  constraint checkpoints_reward_check check (reward_tokens >= 0),
  constraint checkpoints_xp_check check (xp_reward >= 0)
);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  checkpoint_id uuid references public.checkpoints(id) on delete cascade,
  public_token text not null unique,
  kind public.qr_code_kind not null,
  label text not null,
  target_url text,
  created_at timestamptz not null default now(),
  constraint qr_codes_token_format check (public_token ~ '^[A-Za-z0-9_-]{12,80}$')
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  game_code text not null,
  player_code text not null unique,
  session_token_hash text not null unique,
  display_name text not null,
  evolution text,
  level integer not null default 1,
  xp integer not null default 0,
  energy integer not null default 100,
  tokens integer not null default 0,
  status public.player_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_length check (char_length(trim(display_name)) between 2 and 40),
  constraint profiles_player_code_format check (player_code ~ '^player-[a-z0-9-]{8,}$'),
  constraint profiles_energy_check check (energy between 0 and 100),
  constraint profiles_tokens_check check (tokens >= 0)
);

create unique index profiles_game_display_name_unique
  on public.profiles (game_id, lower(display_name));

create index profiles_game_idx on public.profiles (game_id);
create index profiles_game_code_idx on public.profiles (game_code);

create table public.creatures (
  id uuid primary key default gen_random_uuid(),
  pokemon_id integer not null unique,
  pokemon_name text not null,
  rarity text not null,
  sprite_id text not null,
  sprite_url text,
  token_value integer not null default 1,
  created_at timestamptz not null default now(),
  constraint creatures_value_check check (token_value >= 0)
);

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  creature_id uuid references public.creatures(id) on delete set null,
  pokemon_id integer not null,
  pokemon_name text not null,
  rarity text not null,
  sprite_id text not null,
  token_value integer not null default 1,
  source_type text not null default 'battle',
  source_id uuid,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint captures_value_check check (token_value >= 0)
);

create index captures_game_player_idx on public.captures (game_id, player_id);
create index captures_redeemed_idx on public.captures (player_id, redeemed_at);

create table public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  source_type text not null,
  source_id uuid,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint token_transactions_amount_check check (amount <> 0)
);

create index token_transactions_game_player_created_idx
  on public.token_transactions (game_id, player_id, created_at desc);

create table public.game_progress (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  station_id text not null,
  completed_at timestamptz not null default now(),
  unique (player_id, station_id)
);

create index game_progress_game_player_idx on public.game_progress (game_id, player_id);

create table public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete set null,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  public_token text not null,
  user_agent text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index qr_scans_game_created_idx on public.qr_scans (game_id, created_at desc);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  checkpoint_id uuid references public.checkpoints(id) on delete cascade,
  question_key text not null,
  prompt text not null,
  options jsonb not null,
  correct_answer_index integer not null,
  explanation text,
  difficulty integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (game_id, question_key),
  constraint questions_options_array check (jsonb_typeof(options) = 'array'),
  constraint questions_answer_index_check check (correct_answer_index >= 0)
);

create table public.question_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  station_id text not null,
  question_key text not null,
  selected_answer integer,
  is_correct boolean,
  created_at timestamptz not null default now(),
  unique (player_id, question_key)
);

create index question_history_game_player_idx on public.question_history (game_id, player_id);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  kind public.checkpoint_kind not null,
  status public.encounter_status not null default 'started',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index encounters_game_player_idx on public.encounters (game_id, player_id, started_at desc);

create table public.battle_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  encounter_id uuid references public.encounters(id) on delete set null,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  won boolean not null,
  reward_tokens integer not null default 0,
  xp_reward integer not null default 0,
  created_at timestamptz not null default now()
);

create index battle_results_game_player_idx on public.battle_results (game_id, player_id, created_at desc);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  from_player_id uuid not null references public.profiles(id) on delete cascade,
  to_player_id uuid not null references public.profiles(id) on delete cascade,
  station_id text,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_invites_different_players check (from_player_id <> to_player_id)
);

create index team_invites_game_status_idx on public.team_invites (game_id, status, created_at desc);

create table public.arena_matches (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_one_id uuid not null references public.profiles(id) on delete cascade,
  player_two_id uuid not null references public.profiles(id) on delete cascade,
  station_id text,
  challenge text not null,
  reward_tokens integer not null default 2,
  winner_player_id uuid references public.profiles(id) on delete set null,
  loser_player_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint arena_matches_different_players check (player_one_id <> player_two_id)
);

create unique index arena_matches_player_station_unique
  on public.arena_matches (player_one_id, station_id)
  where station_id is not null;

create index arena_matches_game_created_idx on public.arena_matches (game_id, created_at desc);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null,
  token_cost integer not null,
  created_at timestamptz not null default now(),
  constraint redemptions_cost_check check (token_cost >= 0)
);

create index redemptions_game_player_created_idx on public.redemptions (game_id, player_id, created_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  label text not null,
  cost integer,
  is_final boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.final_rewards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  reward_name text not null,
  completed_at timestamptz not null default now(),
  unique (player_id)
);

create table public.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  reason text not null,
  token_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create index admin_adjustments_game_player_created_idx
  on public.admin_adjustments (game_id, player_id, created_at desc);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index game_events_game_created_idx on public.game_events (game_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger buyer_profiles_set_updated_at
before update on public.buyer_profiles
for each row execute function public.set_updated_at();

create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

create trigger game_settings_set_updated_at
before update on public.game_settings
for each row execute function public.set_updated_at();

create trigger purchases_set_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();

create trigger checkpoints_set_updated_at
before update on public.checkpoints
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger team_invites_set_updated_at
before update on public.team_invites
for each row execute function public.set_updated_at();
