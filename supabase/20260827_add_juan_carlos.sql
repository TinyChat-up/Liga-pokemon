-- Ejecutar una sola vez en el proyecto Supabase de Liga Terraza 27.
-- Es idempotente: volver a ejecutarlo no duplica el perfil.
insert into public.profiles (
  player_code,
  display_name,
  evolution,
  level,
  xp,
  energy,
  tokens,
  updated_at
)
select
  'jugador-14',
  'Juan Carlos',
  null,
  1,
  0,
  100,
  0,
  now()
where not exists (
  select 1
  from public.profiles
  where player_code = 'jugador-14'
);

update public.profiles
set display_name = 'Juan Carlos',
    updated_at = now()
where player_code = 'jugador-14';

select id, player_code, display_name, evolution, level, xp, energy, tokens
from public.profiles
where player_code = 'jugador-14';
