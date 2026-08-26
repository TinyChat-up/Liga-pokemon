import type { Player, Question } from "./types";

export function questionKey(question: Question): string {
  const promptPart = question.prompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `${question.tier}:${question.label}:${promptPart}`;
}

export function selectQuestionForPlayer(
  questions: Question[],
  tier: number,
  player: Player,
): Question | null {
  const tierQuestions = questions.filter((item) => item.tier === tier);
  if (!tierQuestions.length) return null;

  const seen = new Set(player.questionHistory ?? []);
  const unseen = tierQuestions.filter((item) => !seen.has(questionKey(item)));
  const pool = unseen.length ? unseen : tierQuestions;

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
