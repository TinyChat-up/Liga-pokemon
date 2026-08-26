import type { Question } from "./types";

export function questionKey(question: Question): string {
  return question.id;
}

export function getNextQuestion(
  questions: Question[],
  usedQuestionIds: string[],
): Question | null {
  if (!questions.length) return null;

  const seen = new Set(usedQuestionIds);
  const pool = questions.filter((item) => !seen.has(item.id));
  if (!pool.length) return null;

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
