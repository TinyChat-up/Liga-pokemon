create or replace function public.reset_liga27_game()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.question_history;
  delete from public.team_invites;
  delete from public.arena_matches;
  delete from public.redemptions;
  delete from public.captures;
  delete from public.game_progress;

  if to_regclass('public.final_attempts') is not null then
    execute 'delete from public.final_attempts';
  end if;

  if to_regclass('public.final_rewards') is not null then
    execute 'delete from public.final_rewards';
  end if;

  update public.profiles
    set evolution = null,
        level = 1,
        xp = 0,
        energy = 100,
        tokens = 0,
        updated_at = now();
end;
$$;

revoke all on function public.reset_liga27_game() from public;
revoke all on function public.reset_liga27_game() from anon;
revoke all on function public.reset_liga27_game() from authenticated;

-- Run manually from the Supabase SQL editor when you want a clean new game:
-- select public.reset_liga27_game();
