import type { Player, Question, Rarity, StationKind } from "./types";

export function hasEvolutionPerk(player: Player): boolean {
  return player.route.length >= 4 && Boolean(player.evolution);
}

export function getStationReward(player: Player, kind: StationKind, baseReward: number): number {
  if (!hasEvolutionPerk(player)) return baseReward;
  if (player.evolution === "Jolteon" && kind === "trainer") return baseReward + 1;
  if (player.evolution === "Sylveon" && kind === "rocket") return baseReward + 1;
  return baseReward;
}

export function getHealingCost(player: Player, configuredCost: number): number {
  const safeCost = Math.max(0, Math.floor(configuredCost));
  if (hasEvolutionPerk(player) && player.evolution === "Vaporeon") {
    return Math.max(0, safeCost - 1);
  }
  return safeCost;
}

export function getFailureDamage(player: Player): number {
  return hasEvolutionPerk(player) && player.evolution === "Umbreon" ? 25 : 50;
}

export function getCaptureRarity(player: Player, roll: number): Rarity {
  if (hasEvolutionPerk(player) && player.evolution === "Leafeon") {
    return roll < 10 ? "Legendario" : roll < 45 ? "Especial" : "Normal";
  }
  return roll < 4 ? "Legendario" : roll < 27 ? "Especial" : "Normal";
}

export function getGlaceonBlockedAnswer(player: Player, question: Question): number | null {
  if (!hasEvolutionPerk(player) || player.evolution !== "Glaceon") return null;
  const wrongAnswers = question.options
    .map((_, index) => index)
    .filter((index) => index !== question.correctAnswer);
  const seed = [...question.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return wrongAnswers[seed % wrongAnswers.length] ?? null;
}
