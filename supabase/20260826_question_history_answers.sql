alter table public.question_history
  add column if not exists selected_answer integer,
  add column if not exists is_correct boolean;

create unique index if not exists question_history_player_question_unique
  on public.question_history (player_id, question_key);
